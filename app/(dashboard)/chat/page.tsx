'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { MessageSquare, Send, Plus, Users, Building2, User as UserIcon, Loader2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type Thread = {
  id: string
  kind: 'direct' | 'department' | 'company'
  title: string | null
  department_id: string | null
  last_message_at: string
  displayName: string
  unread: number
  lastBody?: string
}
type Message = {
  id: string
  thread_id: string
  sender_id: string
  body: string
  created_at: string
  sender?: { full_name: string; avatar_url: string | null }
}
type Profile = { id: string; full_name: string; avatar_url: string | null; role: string }
type Department = { id: string; name: string }

const KIND_ICON = {
  direct:     UserIcon,
  department: Building2,
  company:    Users,
}

export default function ChatPage() {
  const { user } = useAuth()
  const [threads,    setThreads]    = useState<Thread[]>([])
  const [activeId,   setActiveId]   = useState<string | null>(null)
  const [messages,   setMessages]   = useState<Message[]>([])
  const [input,      setInput]      = useState('')
  const [loading,    setLoading]    = useState(true)
  const [sending,    setSending]    = useState(false)
  const [newOpen,    setNewOpen]    = useState(false)
  const [profiles,   setProfiles]   = useState<Profile[]>([])
  const [departments,setDepartments]= useState<Department[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  const canStart = user?.role === 'adm_total' || user?.role === 'rh' || user?.role === 'gestor'
  const activeThread = threads.find(t => t.id === activeId)

  // ── Carrega as conversas que participo ──
  const loadThreads = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const supabase = createClient()

    const { data: memberRows } = await supabase
      .from('chat_thread_members')
      .select('thread_id, last_read_at, chat_threads(id, kind, title, department_id, last_message_at)')
      .eq('profile_id', user.id)

    const raw = (memberRows ?? [])
      .map((r: any) => r.chat_threads)
      .filter(Boolean) as any[]

    // last_read_at por thread
    const lastReadMap: Record<string, string | null> = {}
    for (const r of (memberRows ?? []) as any[]) lastReadMap[r.thread_id] = r.last_read_at

    // Conta não lidas: mensagens de outros após o last_read_at
    const unreadMap: Record<string, number> = {}
    const allIds = raw.map(t => t.id)
    if (allIds.length > 0) {
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('thread_id, sender_id, created_at')
        .in('thread_id', allIds)
      for (const m of (msgs ?? []) as any[]) {
        if (m.sender_id === user.id) continue
        const lr = lastReadMap[m.thread_id]
        if (!lr || m.created_at > lr) unreadMap[m.thread_id] = (unreadMap[m.thread_id] ?? 0) + 1
      }
    }

    // Nomes dos outros membros (para conversas diretas)
    const directIds = raw.filter(t => t.kind === 'direct').map(t => t.id)
    const otherNames: Record<string, string> = {}
    if (directIds.length > 0) {
      const { data: members } = await supabase
        .from('chat_thread_members')
        .select('thread_id, profile_id, profiles(full_name)')
        .in('thread_id', directIds)
      for (const m of (members ?? []) as any[]) {
        if (m.profile_id !== user.id) otherNames[m.thread_id] = m.profiles?.full_name ?? 'Colaborador'
      }
    }

    const list: Thread[] = raw.map(t => ({
      id: t.id,
      kind: t.kind,
      title: t.title,
      department_id: t.department_id,
      last_message_at: t.last_message_at,
      unread: unreadMap[t.id] ?? 0,
      displayName:
        t.kind === 'company'    ? 'Todos os colaboradores' :
        t.kind === 'department' ? (t.title ?? 'Departamento') :
        (otherNames[t.id] ?? 'Conversa'),
    }))
    list.sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''))
    setThreads(list)
    setLoading(false)
  }, [user])

  // ── Carrega mensagens da conversa ativa ──
  const loadMessages = useCallback(async (threadId: string) => {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    const { data } = await supabase
      .from('chat_messages')
      .select('*, sender:profiles(full_name, avatar_url)')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
    setMessages((data as Message[]) ?? [])
    // marca como lida
    await supabase.from('chat_thread_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('thread_id', threadId).eq('profile_id', user!.id)
  }, [user])

  useEffect(() => { loadThreads() }, [loadThreads])

  useEffect(() => {
    if (activeId) loadMessages(activeId)
  }, [activeId, loadMessages])

  // ── Realtime: novas mensagens ──
  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    const supabase = createClient()
    const channel = supabase
      .channel('chat-messages')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `company_id=eq.${user.company_id}` },
        (payload) => {
          const msg = payload.new as Message
          // Se for da conversa aberta, anexa (evita duplicar a própria)
          setMessages(prev => {
            if (msg.thread_id !== activeIdRef.current) return prev
            if (prev.some(m => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          // Atualiza ordem/preview da lista
          loadThreads()
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, loadThreads])

  // Mantém activeId acessível dentro do callback do realtime
  const activeIdRef = useRef<string | null>(null)
  useEffect(() => { activeIdRef.current = activeId }, [activeId])

  // Scroll automático
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── Envia mensagem ──
  const handleSend = async () => {
    const body = input.trim()
    if (!body || !activeId || !user) return
    setSending(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('chat_messages')
      .insert({ thread_id: activeId, company_id: user.company_id, sender_id: user.id, body })
      .select('*, sender:profiles(full_name, avatar_url)')
      .single()
    if (error) { toast.error('Erro ao enviar mensagem'); setSending(false); return }
    // Atualiza last_message_at para ordenar conversas
    await supabase.from('chat_threads').update({ last_message_at: new Date().toISOString() }).eq('id', activeId)
    setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data as Message])
    setInput('')
    setSending(false)
    loadThreads()
  }

  // ── Abre o seletor de nova conversa: carrega perfis e departamentos ──
  const openNew = async () => {
    setNewOpen(true)
    if (!isSupabaseConfigured() || !user) return
    const supabase = createClient()
    const [pRes, dRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, avatar_url, role')
        .eq('company_id', user.company_id).eq('is_active', true).neq('id', user.id).order('full_name'),
      supabase.from('departments').select('id, name').eq('company_id', user.company_id).order('name'),
    ])
    setProfiles((pRes.data as Profile[]) ?? [])
    setDepartments((dRes.data as Department[]) ?? [])
  }

  // ── Cria/abre uma conversa via API ──
  const ensureThread = async (payload: { kind: string; departmentId?: string; targetProfileId?: string }) => {
    const res = await fetch('/api/chat/ensure-thread', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Erro ao abrir conversa'); return }
    setNewOpen(false)
    await loadThreads()
    setActiveId(json.threadId)
  }

  return (
    <div className="h-[calc(100vh-7rem)] flex gap-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* ─── Lista de conversas ─── */}
      <aside className={cn(
        'w-full sm:w-80 border-r border-gray-200 flex flex-col',
        activeId ? 'hidden sm:flex' : 'flex'
      )}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" /> Chat
          </h2>
          {canStart && (
            <>
              <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova</Button>
              <Dialog open={newOpen} onOpenChange={setNewOpen}>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nova conversa</DialogTitle></DialogHeader>
                  <NewConversation
                    profiles={profiles}
                    departments={departments}
                    onPick={ensureThread}
                  />
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-sm text-gray-400">Carregando...</div>
          ) : threads.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              Nenhuma conversa ainda.
              {canStart && <><br />Clique em <strong>Nova</strong> para começar.</>}
            </div>
          ) : threads.map(t => {
            const Icon = KIND_ICON[t.kind]
            return (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors flex items-center gap-3',
                  activeId === t.id && 'bg-blue-50'
                )}
              >
                <div className={cn('h-10 w-10 rounded-full flex items-center justify-center shrink-0',
                  t.kind === 'company' ? 'bg-purple-100 text-purple-600' :
                  t.kind === 'department' ? 'bg-teal-100 text-teal-600' : 'bg-blue-100 text-blue-600')}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate', t.unread > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-900')}>{t.displayName}</p>
                  <p className="text-xs text-gray-400">
                    {t.kind === 'company' ? 'Mensagem para todos' :
                     t.kind === 'department' ? 'Conversa do setor' : 'Conversa individual'}
                  </p>
                </div>
                {t.unread > 0 && activeId !== t.id && (
                  <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                    {t.unread > 9 ? '9+' : t.unread}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </aside>

      {/* ─── Janela de mensagens ─── */}
      <section className={cn('flex-1 flex flex-col', activeId ? 'flex' : 'hidden sm:flex')}>
        {!activeThread ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <MessageSquare className="h-12 w-12 mb-3 opacity-40" />
            <p>Selecione uma conversa</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center gap-3">
              <Button variant="ghost" size="sm" className="sm:hidden -ml-2" onClick={() => setActiveId(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="font-semibold text-gray-900">{activeThread.displayName}</div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {messages.map(m => {
                const mine = m.sender_id === user?.id
                return (
                  <div key={m.id} className={cn('flex gap-2', mine ? 'justify-end' : 'justify-start')}>
                    {!mine && (
                      <Avatar className="h-8 w-8 shrink-0">
                        {m.sender?.avatar_url && <AvatarImage src={m.sender.avatar_url} />}
                        <AvatarFallback className="bg-blue-500 text-white text-xs">
                          {getInitials(m.sender?.full_name ?? '?')}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={cn('max-w-[75%] rounded-2xl px-4 py-2',
                      mine ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border border-gray-200 rounded-bl-sm')}>
                      {!mine && activeThread.kind !== 'direct' && (
                        <p className="text-xs font-semibold text-blue-600 mb-0.5">{m.sender?.full_name}</p>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={cn('text-[10px] mt-1', mine ? 'text-blue-100' : 'text-gray-400')}>
                        {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-gray-200 flex items-end gap-2">
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder="Escreva uma mensagem..."
                className="resize-none min-h-[44px] max-h-32"
                rows={1}
              />
              <Button onClick={handleSend} disabled={sending || !input.trim()} size="icon" className="h-11 w-11 shrink-0">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

// ─── Modal de nova conversa ───
function NewConversation({
  profiles, departments, onPick,
}: {
  profiles: Profile[]
  departments: Department[]
  onPick: (p: { kind: string; departmentId?: string; targetProfileId?: string }) => void
}) {
  const [mode, setMode]   = useState<'direct' | 'department' | 'company'>('direct')
  const [target, setTarget] = useState('')
  const [dept, setDept]   = useState('')
  const [busy, setBusy]   = useState(false)

  const submit = async () => {
    setBusy(true)
    if (mode === 'direct')          await onPick({ kind: 'direct', targetProfileId: target })
    else if (mode === 'department') await onPick({ kind: 'department', departmentId: dept })
    else                            await onPick({ kind: 'company' })
    setBusy(false)
  }

  const valid = mode === 'company' || (mode === 'direct' && target) || (mode === 'department' && dept)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {([
          { v: 'direct',     label: 'Individual', icon: UserIcon },
          { v: 'department', label: 'Por setor',  icon: Building2 },
          { v: 'company',    label: 'Todos',      icon: Users },
        ] as const).map(o => (
          <button
            key={o.v}
            onClick={() => setMode(o.v)}
            className={cn('flex flex-col items-center gap-1.5 p-3 rounded-lg border text-sm transition-colors',
              mode === o.v ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}
          >
            <o.icon className="h-5 w-5" />
            {o.label}
          </button>
        ))}
      </div>

      {mode === 'direct' && (
        <Select value={target} onValueChange={(v) => setTarget(v ?? '')}>
          <SelectTrigger><SelectValue placeholder="Escolha o colaborador..." /></SelectTrigger>
          <SelectContent>
            {profiles.length === 0
              ? <div className="px-3 py-2 text-sm text-gray-400">Nenhum colaborador com acesso ainda.</div>
              : profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {mode === 'department' && (
        <Select value={dept} onValueChange={(v) => setDept(v ?? '')}>
          <SelectTrigger><SelectValue placeholder="Escolha o setor..." /></SelectTrigger>
          <SelectContent>
            {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {mode === 'company' && (
        <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
          Esta conversa envia mensagens para <strong>todos os colaboradores com acesso</strong> da empresa.
        </p>
      )}

      <Button onClick={submit} disabled={!valid || busy} className="w-full">
        {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Abrir conversa
      </Button>
    </div>
  )
}
