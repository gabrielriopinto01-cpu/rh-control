import type { SupabaseClient } from '@supabase/supabase-js'

export type AlertSeverity = 'high' | 'medium' | 'low'

export type AlertType =
  | 'document_expired'
  | 'document_expiring'
  | 'aso_expiring'
  | 'vacation_pending'
  | 'vacation_upcoming'
  | 'birthday'
  | 'work_anniversary'
  | 'equipment_unreturned'
  | 'training_pending'
  | 'approval_pending'

export interface Alert {
  id: string
  type: AlertType
  severity: AlertSeverity
  title: string
  description: string
  href: string
  /** Data relevante (ISO) — vencimento, início de férias, aniversário, etc. */
  date: string | null
}

const DAY = 86400000
const iso = (d: Date) => d.toISOString().slice(0, 10)

/** Próxima ocorrência (este ano ou ano que vem) de um mês-dia, em dias a partir de hoje. */
function daysUntilAnnual(dateStr: string): number | null {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const next = new Date(today.getFullYear(), d.getMonth(), d.getDate())
  if (next < today) next.setFullYear(next.getFullYear() + 1)
  return Math.round((next.getTime() - today.getTime()) / DAY)
}

const ASO_TYPES = new Set(['aso', 'exame_admissional', 'exame_periodico', 'exame_demissional'])

/**
 * Calcula todos os alertas automáticos da empresa:
 * documentos/ASO vencendo ou vencidos, férias pendentes/próximas,
 * aniversários e aniversários de empresa nos próximos dias.
 */
export async function computeAlerts(
  supabase: SupabaseClient,
  companyId: string,
): Promise<Alert[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = iso(today)
  const in30Str  = iso(new Date(today.getTime() + 30 * DAY))

  const [docRes, vacRes, empRes, equipRes, trainRes, compRes, approvalRes] = await Promise.all([
    supabase.from('documents')
      .select('id, name, type, expires_at, employee_id')
      .eq('company_id', companyId)
      .not('expires_at', 'is', null)
      .lte('expires_at', in30Str),
    supabase.from('vacations')
      .select('id, employee_id, status, start_date')
      .eq('company_id', companyId)
      .in('status', ['pending', 'approved']),
    supabase.from('employees')
      .select('id, full_name, birth_date, hire_date, status')
      .eq('company_id', companyId)
      .eq('status', 'active'),
    supabase.from('equipment')
      .select('id, name, employee_id, status, employee:employees(full_name, status)')
      .eq('company_id', companyId)
      .eq('status', 'entregue'),
    supabase.from('trainings')
      .select('id')
      .eq('company_id', companyId)
      .eq('is_active', true),
    supabase.from('training_completions')
      .select('id')
      .eq('company_id', companyId),
    supabase.from('approval_requests')
      .select('id, type, created_at')
      .eq('company_id', companyId)
      .eq('status', 'pending'),
  ])

  const employees = empRes.data ?? []
  const nameOf = (id: string | null) =>
    employees.find(e => e.id === id)?.full_name ?? 'Colaborador'

  const alerts: Alert[] = []

  // ── Documentos / ASO ──
  for (const d of (docRes.data ?? [])) {
    if (!d.expires_at) continue
    const expired = d.expires_at < todayStr
    const isAso = ASO_TYPES.has(d.type)
    alerts.push({
      id: `doc-${d.id}`,
      type: isAso ? 'aso_expiring' : (expired ? 'document_expired' : 'document_expiring'),
      severity: expired ? 'high' : isAso ? 'high' : 'medium',
      title: expired
        ? `${isAso ? 'Exame/ASO' : 'Documento'} vencido: ${d.name}`
        : `${isAso ? 'Exame/ASO' : 'Documento'} vencendo: ${d.name}`,
      description: `${nameOf(d.employee_id)} · ${expired ? 'venceu' : 'vence'} em ${new Date(d.expires_at).toLocaleDateString('pt-BR')}`,
      href: '/documents',
      date: d.expires_at,
    })
  }

  // ── Férias ──
  for (const v of (vacRes.data ?? [])) {
    if (v.status === 'pending') {
      alerts.push({
        id: `vac-pend-${v.id}`,
        type: 'vacation_pending',
        severity: 'medium',
        title: 'Solicitação de férias pendente',
        description: `${nameOf(v.employee_id)} · aguardando aprovação`,
        href: '/vacations',
        date: v.start_date ?? null,
      })
    } else if (v.status === 'approved' && v.start_date) {
      const days = Math.round((new Date(v.start_date).getTime() - today.getTime()) / DAY)
      if (days >= 0 && days <= 30) {
        alerts.push({
          id: `vac-up-${v.id}`,
          type: 'vacation_upcoming',
          severity: 'low',
          title: 'Férias se aproximando',
          description: `${nameOf(v.employee_id)} · inicia em ${new Date(v.start_date).toLocaleDateString('pt-BR')}`,
          href: '/vacations',
          date: v.start_date,
        })
      }
    }
  }

  // ── Aniversários e aniversário de empresa (próximos 7 dias) ──
  for (const e of employees) {
    if (e.birth_date) {
      const d = daysUntilAnnual(e.birth_date)
      if (d !== null && d <= 7) {
        alerts.push({
          id: `bday-${e.id}`,
          type: 'birthday',
          severity: 'low',
          title: d === 0 ? `🎉 Aniversário hoje: ${e.full_name}` : `Aniversário em ${d} dia${d > 1 ? 's' : ''}: ${e.full_name}`,
          description: 'Aniversário do colaborador',
          href: `/employees/${e.id}`,
          date: e.birth_date,
        })
      }
    }
    if (e.hire_date) {
      const d = daysUntilAnnual(e.hire_date)
      if (d !== null && d <= 7) {
        const years = today.getFullYear() - new Date(e.hire_date).getFullYear()
        if (years > 0) {
          alerts.push({
            id: `anniv-${e.id}`,
            type: 'work_anniversary',
            severity: 'low',
            title: d === 0 ? `${years} ano(s) de empresa: ${e.full_name}` : `${years} ano(s) de empresa em ${d} dia${d > 1 ? 's' : ''}: ${e.full_name}`,
            description: 'Aniversário de admissão',
            href: `/employees/${e.id}`,
            date: e.hire_date,
          })
        }
      }
    }
  }

  // ── Equipamentos entregues a colaboradores desligados ──
  for (const eq of (equipRes.data ?? []) as any[]) {
    const emp = eq.employee as { full_name?: string; status?: string } | null
    if (emp?.status === 'terminated') {
      alerts.push({
        id: `equip-${eq.id}`,
        type: 'equipment_unreturned',
        severity: 'high',
        title: `Equipamento não devolvido: ${eq.name}`,
        description: `${emp.full_name ?? 'Colaborador'} foi desligado e ainda consta com o item`,
        href: '/equipamentos',
        date: null,
      })
    }
  }

  // ── Treinamentos pendentes (agregado) ──
  const activeTrainings = (trainRes.data ?? []).length
  const completions     = (compRes.data ?? []).length
  const expected        = activeTrainings * employees.length
  if (activeTrainings > 0 && completions < expected) {
    alerts.push({
      id: 'trainings-pending',
      type: 'training_pending',
      severity: 'low',
      title: `${expected - completions} conclusão(ões) de treinamento pendente(s)`,
      description: `${activeTrainings} treinamento(s) ativo(s) para ${employees.length} colaborador(es)`,
      href: '/treinamentos',
      date: null,
    })
  }

  // ── Aprovações pendentes ──
  const pendingApprovals = (approvalRes.data ?? [])
  if (pendingApprovals.length > 0) {
    const TYPE_LABEL: Record<string, string> = {
      vacation: 'férias', expense: 'despesa', absence: 'afastamento', other: 'solicitação'
    }
    pendingApprovals.forEach(a => {
      alerts.push({
        id: `approval-${a.id}`,
        type: 'approval_pending',
        severity: 'medium',
        title: `Aprovação pendente: ${TYPE_LABEL[a.type] ?? a.type}`,
        description: 'Aguardando sua ação em Workflows',
        href: '/workflows',
        date: a.created_at ?? null,
      })
    })
  }

  // Ordena: severidade alta primeiro, depois por data
  const sevRank: Record<AlertSeverity, number> = { high: 0, medium: 1, low: 2 }
  alerts.sort((a, b) =>
    sevRank[a.severity] - sevRank[b.severity] ||
    (a.date ?? '').localeCompare(b.date ?? '')
  )

  return alerts
}
