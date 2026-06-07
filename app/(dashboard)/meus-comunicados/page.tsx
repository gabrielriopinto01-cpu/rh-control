'use client'

import { useEffect, useState, useCallback } from 'react'
import { Megaphone, CheckCircle2, AlertTriangle, Info, Zap, Bell } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useMyEmployee } from '@/hooks/use-my-employee'

export const dynamic = 'force-dynamic'

type Announcement = {
  id: string; title: string; content: string; type: string
  target_audience: string; expires_at: string | null; created_at: string
  reads?: { read_at: string }[]
}

const TYPE_CONFIG = {
  info:    { label: 'Informativo', icon: Info,           bg: 'bg-blue-50',  border: 'border-blue-200',  badge: 'bg-blue-100 text-blue-700',  icon_color: 'text-blue-500' },
  warning: { label: 'Atenção',     icon: AlertTriangle,  bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', icon_color: 'text-amber-500' },
  urgent:  { label: 'Urgente',     icon: Zap,            bg: 'bg-red-50',   border: 'border-red-200',   badge: 'bg-red-100 text-red-700',     icon_color: 'text-red-500' },
}

export default function MeusComunicadosPage() {
  const { user }        = useAuth()
  const { employee }    = useMyEmployee()
  const [items,     setItems]     = useState<Announcement[]>([])
  const [loading,   setLoading]   = useState(true)
  const [expanded,  setExpanded]  = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user || !employee) return
    setLoading(true)
    const supabase = createClient()

    // Busca comunicados ativos para o colaborador (todos + departamento dele)
    const { data } = await supabase
      .from('announcements')
      .select('*, reads:announcement_reads(read_at)')
      .eq('company_id', user.company_id)
      .eq('is_active', true)
      .or(`target_audience.eq.all,target_department_id.eq.${employee.department_id ?? '00000000-0000-0000-0000-000000000000'}`)
      .order('created_at', { ascending: false })

    setItems((data as Announcement[]) ?? [])
    setLoading(false)
  }, [user, employee])

  useEffect(() => { load() }, [load])

  const markAsRead = async (id: string) => {
    if (!employee) return
    const supabase = createClient()
    const { error } = await supabase.from('announcement_reads').insert({
      announcement_id: id,
      employee_id:     employee.id,
    })
    if (!error) {
      // Atualiza local
      setItems(prev => prev.map(a =>
        a.id === id
          ? { ...a, reads: [{ read_at: new Date().toISOString() }] }
          : a
      ))
    }
    setExpanded(id)
  }

  const handleExpand = async (ann: Announcement) => {
    const alreadyRead = (ann.reads ?? []).length > 0
    if (!alreadyRead) await markAsRead(ann.id)
    else setExpanded(expanded === ann.id ? null : ann.id)
  }

  const unread = items.filter(a => (a.reads ?? []).length === 0)
  const read   = items.filter(a => (a.reads ?? []).length > 0)

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-100 rounded-lg relative">
          <Megaphone className="h-5 w-5 text-amber-600" />
          {unread.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {unread.length}
            </span>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comunicados</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {unread.length > 0
              ? `${unread.length} comunicado${unread.length > 1 ? 's' : ''} não lido${unread.length > 1 ? 's' : ''}`
              : 'Tudo em dia!'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando comunicados...</div>
      ) : items.length === 0 ? (
        <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Nenhum comunicado no momento</p>
          <p className="text-gray-300 text-sm mt-1">Quando houver novidades, elas aparecerão aqui</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Não lidos */}
          {unread.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Não lidos</p>
              {unread.map(ann => {
                const cfg = TYPE_CONFIG[ann.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.info
                const Icon = cfg.icon
                const isOpen = expanded === ann.id

                return (
                  <div key={ann.id}
                    className={`rounded-xl border-2 ${cfg.border} ${cfg.bg} overflow-hidden transition-all`}>
                    <button
                      onClick={() => handleExpand(ann)}
                      className="w-full text-left p-5"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg bg-white/60 shrink-0`}>
                          <Icon className={`h-5 w-5 ${cfg.icon_color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.badge}`}>
                              {cfg.label}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(ann.created_at).toLocaleDateString('pt-BR')}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-600 ml-auto">
                              Novo
                            </span>
                          </div>
                          <h3 className="font-bold text-gray-900 mt-1.5">{ann.title}</h3>
                          {!isOpen && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-1">{ann.content}</p>
                          )}
                        </div>
                      </div>
                      {isOpen && (
                        <div className="mt-4 pl-11">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{ann.content}</p>
                          {ann.expires_at && (
                            <p className="text-xs text-gray-400 mt-3">
                              Válido até {new Date(ann.expires_at).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-200/60">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-xs text-green-600 font-medium">Marcado como lido</span>
                          </div>
                        </div>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Lidos */}
          {read.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Lidos</p>
              {read.map(ann => {
                const cfg = TYPE_CONFIG[ann.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.info
                const Icon = cfg.icon
                const isOpen = expanded === ann.id

                return (
                  <div key={ann.id}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden opacity-75 hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setExpanded(isOpen ? null : ann.id)}
                      className="w-full text-left p-4"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`h-4 w-4 ${cfg.icon_color} shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-gray-700 truncate">{ann.title}</h3>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 shrink-0">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                          <span>{new Date(ann.reads![0].read_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                      {isOpen && (
                        <p className="text-sm text-gray-600 mt-3 pl-7 whitespace-pre-wrap">{ann.content}</p>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
