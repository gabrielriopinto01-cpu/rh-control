'use client'

import { useEffect, useState, useCallback } from 'react'
import { ClipboardCheck, Plus, Loader2, CheckCircle2, XCircle, Clock, Eye, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useMyEmployee } from '@/hooks/use-my-employee'

export const dynamic = 'force-dynamic'

const TYPES: Record<string, string> = {
  vacation:       'Férias',
  time_adjustment:'Ajuste de Ponto',
  document:       'Documento',
  advance:        'Adiantamento Salarial',
  benefit_change: 'Alteração de Benefício',
  transfer:       'Transferência de Setor',
  remote_work:    'Trabalho Remoto',
  training:       'Treinamento',
  other:          'Outro',
}

const PRIORITIES: Record<string, { label: string; color: string }> = {
  low:    { label: 'Baixa',   color: 'bg-gray-100 text-gray-600' },
  normal: { label: 'Normal',  color: 'bg-blue-100 text-blue-700' },
  high:   { label: 'Alta',    color: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgente', color: 'bg-red-100 text-red-700' },
}

const STATUSES: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  pending:   { label: 'Pendente',    icon: Clock,         color: 'bg-yellow-100 text-yellow-700' },
  in_review: { label: 'Em análise',  icon: Eye,           color: 'bg-blue-100 text-blue-700' },
  approved:  { label: 'Aprovado',    icon: CheckCircle2,  color: 'bg-green-100 text-green-700' },
  rejected:  { label: 'Recusado',    icon: XCircle,       color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelado',   icon: XCircle,       color: 'bg-gray-100 text-gray-500' },
}

type Request = {
  id: string; type: string; title: string; description: string
  status: string; priority: string; start_date?: string; end_date?: string
  response?: string; created_at: string; reviewed_at?: string
  employee?: { full_name: string; department?: { name: string } }
}

type Form = {
  type: string; title: string; description: string; priority: string
  start_date: string; end_date: string
}

const blank = (): Form => ({ type: 'other', title: '', description: '', priority: 'normal', start_date: '', end_date: '' })

export default function SolicitacoesPage() {
  const { user }      = useAuth()
  const { employee }  = useMyEmployee()
  const isRH          = ['adm_total', 'rh', 'gestor'].includes(user?.role ?? '')
  const [requests, setRequests] = useState<Request[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('pending')
  const [dialog,   setDialog]   = useState(false)
  const [selected, setSelected] = useState<Request | null>(null)
  const [response, setResponse] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [form,     setForm]     = useState<Form>(blank())

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const sb = createClient()
    let q = sb.from('employee_requests')
      .select('*, employee:employees(full_name, department:departments(name))')
      .eq('company_id', user.company_id)
      .order('created_at', { ascending: false })
    if (!isRH && employee) q = q.eq('employee_id', employee.id)
    const { data } = await q
    setRequests((data ?? []) as Request[])
    setLoading(false)
  }, [user, employee, isRH])

  useEffect(() => { load() }, [load])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.description.trim()) { toast.error('Preencha título e descrição'); return }
    if (!employee) { toast.error('Seu usuário não está vinculado a um colaborador'); return }
    setSaving(true)
    const { error } = await createClient().from('employee_requests').insert({
      company_id: user!.company_id,
      employee_id: employee.id,
      type: form.type,
      title: form.title.trim(),
      description: form.description.trim(),
      priority: form.priority,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    })
    setSaving(false)
    if (error) { toast.error('Erro ao enviar solicitação'); return }
    toast.success('Solicitação enviada!')
    setDialog(false); setForm(blank()); load()
  }

  const review = async (req: Request, status: 'approved' | 'rejected' | 'in_review') => {
    const { error } = await createClient().from('employee_requests').update({
      status,
      response: response.trim() || null,
      reviewed_by: user!.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', req.id)
    if (error) { toast.error('Erro ao atualizar'); return }
    toast.success(status === 'approved' ? 'Aprovado!' : status === 'rejected' ? 'Recusado' : 'Em análise')
    setSelected(null); setResponse(''); load()
  }

  const visible = requests.filter(r => filter === 'all' || r.status === filter)
  const counts = Object.fromEntries(Object.keys(STATUSES).map(k => [k, requests.filter(r => r.status === k).length]))

  if (loading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6" />
            {isRH ? 'Solicitações dos Colaboradores' : 'Minhas Solicitações'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isRH ? 'Gerencie e responda solicitações da equipe' : 'Envie e acompanhe suas solicitações ao RH'}
          </p>
        </div>
        {!isRH && (
          <Button onClick={() => { setForm(blank()); setDialog(true) }}>
            <Plus className="h-4 w-4 mr-2" /> Nova solicitação
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {[['all', 'Todas', requests.length], ...Object.entries(STATUSES).map(([k, v]) => [k, v.label, counts[k] ?? 0])].map(([key, label, count]) => (
          <button key={key} onClick={() => setFilter(key as string)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
              filter === key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-card border-gray-200 text-gray-600 hover:border-gray-300'
            }`}>
            {label} <span className={`ml-1 text-xs ${filter === key ? 'text-indigo-200' : 'text-gray-400'}`}>{count}</span>
          </button>
        ))}
      </div>

      {/* Lista */}
      {visible.length === 0 ? (
        <div className="border border-dashed rounded-xl p-12 text-center text-muted-foreground">
          <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Nenhuma solicitação{filter !== 'all' ? ' neste status' : ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(req => {
            const st  = STATUSES[req.status]!
            const pri = PRIORITIES[req.priority]!
            const Icon = st.icon
            return (
              <div key={req.id} className="bg-card border rounded-xl p-4 hover:border-indigo-200 transition-colors cursor-pointer"
                onClick={() => { setSelected(req); setResponse(req.response ?? '') }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{req.title}</p>
                      <Badge className={`text-xs ${pri.color}`}>{pri.label}</Badge>
                    </div>
                    {isRH && req.employee && (
                      <p className="text-sm text-muted-foreground">
                        {(req.employee as any).full_name} · {(req.employee as any).department?.name ?? '—'}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">{TYPES[req.type] ?? req.type} · {new Date(req.created_at).toLocaleDateString('pt-BR')}</p>
                    {req.description && <p className="text-sm text-foreground line-clamp-2">{req.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${st.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {st.label}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Dialog: Nova solicitação (colaborador) */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova solicitação</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v ?? 'other' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v ?? 'normal' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRIORITIES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input placeholder="Resumo da solicitação" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição *</Label>
              <Textarea rows={4} placeholder="Descreva sua solicitação com detalhes..." value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            {['vacation','remote_work','training'].includes(form.type) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Data início</Label>
                  <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Data fim</Label>
                  <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enviar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Detalhe / Resposta (RH) */}
      <Dialog open={!!selected} onOpenChange={v => { if (!v) { setSelected(null); setResponse('') } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Tipo</p><p>{TYPES[selected.type]}</p></div>
                <div><p className="text-xs text-muted-foreground">Prioridade</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITIES[selected.priority]?.color}`}>{PRIORITIES[selected.priority]?.label}</span>
                </div>
                {isRH && selected.employee && (
                  <div className="col-span-2"><p className="text-xs text-muted-foreground">Colaborador</p>
                    <p>{(selected.employee as any).full_name} · {(selected.employee as any).department?.name ?? '—'}</p>
                  </div>
                )}
                {(selected.start_date || selected.end_date) && (
                  <div className="col-span-2"><p className="text-xs text-muted-foreground">Período</p>
                    <p>{[selected.start_date, selected.end_date].filter(Boolean).map(d => new Date(d! + 'T00:00:00').toLocaleDateString('pt-BR')).join(' → ')}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                <p className="text-sm whitespace-pre-wrap bg-muted/30 rounded-lg p-3">{selected.description}</p>
              </div>
              {isRH && (
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Resposta / Justificativa</Label>
                  <Textarea rows={3} placeholder="Deixe uma mensagem para o colaborador (opcional)..."
                    value={response} onChange={e => setResponse(e.target.value)} />
                </div>
              )}
              {selected.response && !isRH && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Resposta do RH</p>
                  <p className="text-sm bg-muted/30 rounded-lg p-3 whitespace-pre-wrap">{selected.response}</p>
                </div>
              )}
              {isRH && (
                <div className="flex gap-2 flex-wrap pt-1">
                  {selected.status !== 'in_review' && (
                    <Button variant="outline" size="sm" onClick={() => review(selected, 'in_review')}>
                      <Eye className="h-3.5 w-3.5 mr-1.5" /> Em análise
                    </Button>
                  )}
                  {selected.status !== 'approved' && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => review(selected, 'approved')}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Aprovar
                    </Button>
                  )}
                  {selected.status !== 'rejected' && (
                    <Button size="sm" variant="destructive" onClick={() => review(selected, 'rejected')}>
                      <XCircle className="h-3.5 w-3.5 mr-1.5" /> Recusar
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
