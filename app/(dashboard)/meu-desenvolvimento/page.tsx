'use client'

import { useEffect, useState } from 'react'
import { Target, BookOpen, CheckCircle, Circle, Clock, TrendingUp } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export const dynamic = 'force-dynamic'

const STATUS_PDI: Record<string, { label: string; Icon: any; color: string }> = {
  pending:     { label: 'Pendente',     Icon: Circle,      color: 'text-muted-foreground' },
  in_progress: { label: 'Em andamento', Icon: Clock,       color: 'text-blue-500' },
  done:        { label: 'Concluído',    Icon: CheckCircle, color: 'text-green-500' },
  cancelled:   { label: 'Cancelado',   Icon: Circle,       color: 'text-red-400' },
}

const CAT_LABELS: Record<string, string> = {
  skill: 'Técnica', behavior: 'Comportamento', knowledge: 'Conhecimento', career: 'Carreira',
}

function progress(current: number, target: number) {
  if (target === 0) return 0
  return Math.min(100, Math.round((current / target) * 100))
}

export default function MeuDesenvolvimentoPage() {
  const { user } = useAuth()
  const [okrs, setOkrs] = useState<any[]>([])
  const [pdi,  setPdi]  = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured() || !user?.employee_id) { setLoading(false); return }
    const supabase = createClient()
    Promise.all([
      supabase.from('okrs').select('*, key_results(*)').eq('employee_id', user.employee_id).order('created_at', { ascending: false }),
      supabase.from('pdi_items').select('*').eq('employee_id', user.employee_id).neq('status', 'cancelled').order('target_date', { ascending: true }),
    ]).then(([okrRes, pdiRes]) => {
      setOkrs(okrRes.data ?? [])
      setPdi(pdiRes.data ?? [])
      setLoading(false)
    })
  }, [user])

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>

  const pdiDone = pdi.filter(i => i.status === 'done').length
  const pdiPct  = pdi.length ? Math.round((pdiDone / pdi.length) * 100) : 0

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="h-6 w-6" /> Meu Desenvolvimento</h1>
        <p className="text-muted-foreground text-sm mt-1">Seus OKRs e Plano de Desenvolvimento Individual</p>
      </div>

      {/* ── OKRs ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold flex items-center gap-2 mb-4">
          <Target className="h-4 w-4" /> OKRs
        </h2>
        {okrs.length === 0 ? (
          <div className="text-center py-8 border border-dashed rounded-xl text-muted-foreground text-sm">
            Nenhum OKR definido ainda
          </div>
        ) : (
          <div className="space-y-4">
            {okrs.map(okr => {
              const krs = okr.key_results ?? []
              const avg = krs.length ? Math.round(krs.reduce((s: number, k: any) => s + progress(k.current, k.target), 0) / krs.length) : 0
              return (
                <div key={okr.id} className="bg-card border rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{okr.objective}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{okr.cycle}</p>
                    </div>
                    <span className="text-sm font-bold text-primary">{avg}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${avg}%` }} />
                  </div>
                  {krs.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {krs.map((kr: any) => {
                        const pct = progress(kr.current, kr.target)
                        return (
                          <div key={kr.id} className="text-sm">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>{kr.description}</span>
                              <span>{kr.current}/{kr.target} {kr.unit}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-primary' : 'bg-yellow-400'}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── PDI ──────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Plano de Desenvolvimento (PDI)
          </h2>
          {pdi.length > 0 && (
            <span className="text-sm text-muted-foreground">{pdiDone}/{pdi.length} concluídos ({pdiPct}%)</span>
          )}
        </div>
        {pdi.length === 0 ? (
          <div className="text-center py-8 border border-dashed rounded-xl text-muted-foreground text-sm">
            Nenhum item de PDI definido ainda
          </div>
        ) : (
          <div className="space-y-2">
            {pdi.map(item => {
              const st = STATUS_PDI[item.status] ?? STATUS_PDI.pending!
              const overdue = item.target_date && item.status !== 'done' && new Date(item.target_date) < new Date()
              return (
                <div key={item.id} className="bg-card border rounded-lg p-3 flex items-start gap-3">
                  <st.Icon className={`h-5 w-5 mt-0.5 shrink-0 ${st.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${item.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{item.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">{CAT_LABELS[item.category] ?? item.category}</span>
                      {item.target_date && (
                        <span className={`text-xs ${overdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                          · prazo {new Date(item.target_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                          {overdue && ' ⚠️'}
                        </span>
                      )}
                    </div>
                    {item.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{item.description}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{st.label}</span>
                </div>
              )
            })}
          </div>
        )}

        {pdi.length > 0 && (
          <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pdiPct}%` }} />
          </div>
        )}
      </section>
    </div>
  )
}
