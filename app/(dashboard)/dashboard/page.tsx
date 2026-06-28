'use client'

import { useEffect, useState, useCallback } from 'react'
import lazyLoad from 'next/dynamic'
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'
import ColaboradorDashboard from './colaborador-dashboard'
import { Users, DollarSign, UserCheck, AlertCircle, Palmtree, Briefcase } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency, formatDate } from '@/lib/utils'

// Recharts lazy-loaded — sai do bundle inicial (~200 KB gzip)
const DashboardCharts = lazyLoad(() => import('./charts'), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  ),
})

export const dynamic = 'force-dynamic'

interface DashboardData {
  activeEmployees: number
  totalEmployees: number
  pendingVacations: number
  expiringDocs: number
  openJobs: number
  currentPayrollNet: number | null
  admissionsThisMonth: number
  terminationsThisMonth: number
  reviewsThisMonth: number
  pendingApprovals: number
  turnoverRate: number
  absenteeism: number
  absencesThisMonth: number
  latesThisMonth: number
  certsThisMonth: number
  recentEmployees: { id: string; full_name: string; hire_date: string; status: string }[]
  headcountByMonth: { month: string; total: number }[]
  payrollTrend: { month: string; liquido: number }[]
  empByStatus: { name: string; value: number }[]
  headcountByDept: { dept: string; total: number }[]
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  on_leave: 'bg-yellow-100 text-yellow-700',
  terminated: 'bg-red-100 text-red-700',
}
const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo', inactive: 'Inativo', on_leave: 'Afastado', terminated: 'Desligado',
}

const BAR_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444']

function monthShort(ref: string) {
  const [y, m] = ref.split('-')
  return new Date(+y, +m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' })
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const supabase   = createClient()
    const today      = new Date().toISOString().slice(0, 10)
    const in30days   = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    const monthStart = today.slice(0, 7) + '-01'
    const refMonth   = today.slice(0, 7)

    const last6: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      last6.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }

    const isGestor = user.role === 'gestor' && !!user.department_id

    // Gestor só vê dados do próprio departamento
    let empQ = supabase.from('employees').select('id, full_name, hire_date, termination_date, status')
      .eq('company_id', user.company_id).order('hire_date', { ascending: false })
    if (isGestor) empQ = empQ.eq('department_id', user.department_id!)

    let vacQ = supabase.from('vacations').select('id, status, employee_id').eq('company_id', user.company_id)

    const [empRes, vacRes, docRes, jobRes, payRes, payTrendRes, reviewRes, attRes, certRes, approvalRes, deptRes] = await Promise.allSettled([
      empQ,
      vacQ,
      supabase.from('documents').select('id, expires_at').eq('company_id', user.company_id),
      supabase.from('job_openings').select('id, status').eq('company_id', user.company_id),
      supabase.from('payrolls').select('total_net').eq('company_id', user.company_id)
        .eq('reference_month', refMonth).maybeSingle(),
      supabase.from('payrolls').select('reference_month, total_net').eq('company_id', user.company_id)
        .in('reference_month', last6).order('reference_month'),
      supabase.from('performance_reviews').select('id, created_at').eq('company_id', user.company_id),
      supabase.from('attendance_records').select('status').eq('company_id', user.company_id).gte('date', monthStart),
      supabase.from('medical_certificates').select('days, start_date').eq('company_id', user.company_id).gte('start_date', monthStart),
      supabase.from('approval_requests').select('id').eq('company_id', user.company_id).eq('status', 'pending'),
      supabase.from('employees').select('department:departments(name)').eq('company_id', user.company_id).eq('status', 'active').not('department_id', 'is', null),
    ])

    const employees = (empRes.status === 'fulfilled' ? empRes.value.data : null) ?? []
    const allVacs   = (vacRes.status === 'fulfilled' ? vacRes.value.data : null) ?? []
    // Gestor filtra férias pelos IDs dos próprios colaboradores
    const empIdSet  = new Set(employees.map((e: { id: string }) => e.id))
    const vacations = isGestor ? allVacs.filter((v: { employee_id: string }) => empIdSet.has(v.employee_id)) : allVacs
    const docs      = (docRes.status === 'fulfilled' ? docRes.value.data : null) ?? []
    const jobs      = (jobRes.status === 'fulfilled' ? jobRes.value.data : null) ?? []
    const reviews   = (reviewRes.status === 'fulfilled' ? reviewRes.value.data : null) ?? []
    const payTrend  = (payTrendRes.status === 'fulfilled' ? payTrendRes.value.data : null) ?? []
    const payResData = payRes.status === 'fulfilled' ? payRes.value.data : null

    const activeEmps    = employees.filter(e => e.status === 'active')
    const expiringDocs  = docs.filter(d => d.expires_at && d.expires_at >= today && d.expires_at <= in30days).length
    const admissions    = employees.filter(e => e.hire_date >= monthStart).length
    const terminations  = employees.filter(e => e.termination_date && e.termination_date >= monthStart).length
    const reviewsMonth  = reviews.filter(r => r.created_at >= monthStart).length

    const attendance     = (attRes.status === 'fulfilled' ? attRes.value.data : null) ?? []
    const certs          = (certRes.status === 'fulfilled' ? certRes.value.data : null) ?? []
    const pendingApprovals = ((approvalRes.status === 'fulfilled' ? approvalRes.value.data : null) ?? []).length
    const absences    = attendance.filter((a: { status: string }) => a.status === 'absent').length
    const lates       = attendance.filter((a: { status: string }) => a.status === 'late').length
    const certDays    = certs.reduce((s: number, c: { days: number }) => s + (c.days ?? 0), 0)
    // Turnover do mês = desligamentos / ativos
    const turnoverRate = activeEmps.length > 0 ? +((terminations / activeEmps.length) * 100).toFixed(1) : 0
    // Absenteísmo = (faltas + dias de atestado) / (ativos × 22 dias úteis)
    const absenteeism  = activeEmps.length > 0 ? +(((absences + certDays) / (activeEmps.length * 22)) * 100).toFixed(1) : 0

    const headcountByMonth = last6.map(m => {
      const monthEnd = m + '-31'
      const count = employees.filter(e =>
        e.hire_date <= monthEnd &&
        (!e.termination_date || e.termination_date > m + '-01')
      ).length
      return { month: monthShort(m), total: count }
    })

    const payrollMap   = Object.fromEntries(payTrend.map(p => [p.reference_month, p.total_net]))
    const payrollTrend = last6.map(m => ({
      month: monthShort(m),
      liquido: payrollMap[m] ?? 0,
    }))

    const statusCount: Record<string, number> = {}
    for (const e of employees) statusCount[e.status] = (statusCount[e.status] ?? 0) + 1
    const empByStatus = Object.entries(statusCount).map(([k, v]) => ({
      name: STATUS_LABELS[k] ?? k, value: v,
    }))

    const deptEmps = (deptRes.status === 'fulfilled' ? deptRes.value.data : null) ?? []
    const deptCount: Record<string, number> = {}
    for (const e of deptEmps) {
      const name = (e.department as any)?.name ?? 'Sem depto'
      deptCount[name] = (deptCount[name] ?? 0) + 1
    }
    const headcountByDept = Object.entries(deptCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([dept, total]) => ({ dept, total }))

    setData({
      activeEmployees:       activeEmps.length,
      totalEmployees:        employees.length,
      pendingVacations:      vacations.filter(v => v.status === 'pending').length,
      expiringDocs,
      openJobs:              jobs.filter(j => j.status === 'open').length,
      currentPayrollNet:     payResData?.total_net ?? null,
      admissionsThisMonth:   admissions,
      terminationsThisMonth: terminations,
      reviewsThisMonth:      reviewsMonth,
      pendingApprovals,
      turnoverRate,
      absenteeism,
      absencesThisMonth:     absences,
      latesThisMonth:        lates,
      certsThisMonth:        certs.length,
      recentEmployees:       employees.slice(0, 5).map(e => ({
        id: e.id, full_name: e.full_name, hire_date: e.hire_date, status: e.status,
      })),
      headcountByMonth,
      payrollTrend,
      empByStatus,
      headcountByDept,
    })
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // Exibe wizard de onboarding para novos usuários adm/rh sem colaboradores
  useEffect(() => {
    if (!data || !user) return
    if (!['adm_total', 'rh'].includes(user.role)) return
    if (localStorage.getItem('rh_onboarding_done')) return
    if (data.totalEmployees === 0) setShowOnboarding(true)
  }, [data, user])

  // Colaboradores veem um dashboard personalizado
  if (user?.role === 'colaborador') {
    return <ColaboradorDashboard />
  }

  return (
    <div className="space-y-6">
      {showOnboarding && (
        <OnboardingWizard onClose={() => setShowOnboarding(false)} />
      )}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Visão geral do seu RH</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Colaboradores ativos', value: data?.activeEmployees,  icon: Users,      color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Vagas abertas',        value: data?.openJobs,         icon: Briefcase,  color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Férias pendentes',     value: data?.pendingVacations, icon: Palmtree,   color: 'text-orange-600', bg: 'bg-orange-50' },
          {
            label: 'Folha do mês',
            value: data?.currentPayrollNet != null ? formatCurrency(data.currentPayrollNet) : null,
            icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50',
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className={`p-3 rounded-xl ${bg} shrink-0`}>
                <Icon className={`h-6 w-6 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-500 truncate">{label}</p>
                {loading
                  ? <Skeleton className="h-8 w-20 mt-1" />
                  : <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
                }
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Indicadores executivos */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Indicadores executivos (mês)</p>
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          {[
            { label: 'Turnover',        value: data ? `${data.turnoverRate}%` : null,  hint: `${data?.terminationsThisMonth ?? 0} desligamento(s)`, color: 'text-red-600' },
            { label: 'Absenteísmo',     value: data ? `${data.absenteeism}%` : null,   hint: 'faltas + atestados',                                  color: 'text-amber-600' },
            { label: 'Faltas',          value: data?.absencesThisMonth,                hint: 'no mês',                                              color: 'text-orange-600' },
            { label: 'Atestados',       value: data?.certsThisMonth,                   hint: 'no mês',                                              color: 'text-purple-600' },
            { label: 'Docs vencendo',   value: data?.expiringDocs,                     hint: 'próximos 30 dias',                                    color: 'text-yellow-600' },
          ].map(({ label, value, hint, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">{label}</p>
              {loading
                ? <Skeleton className="h-7 w-16 mt-1" />
                : <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value ?? '—'}</p>}
              <p className="text-xs text-gray-400 mt-0.5">{hint}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Gráficos — lazy loaded */}
      {!loading && data && (
        <DashboardCharts
          headcountByMonth={data.headcountByMonth}
          payrollTrend={data.payrollTrend}
          empByStatus={data.empByStatus}
          headcountByDept={data.headcountByDept}
        />
      )}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      )}

      {/* Resumo do mês + Pendências */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pendências */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Pendências
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'Férias aguardando aprovação', value: data?.pendingVacations,  color: 'bg-orange-100 text-orange-700' },
                { label: 'Aprovações de workflow',      value: data?.pendingApprovals,  color: 'bg-purple-100 text-purple-700' },
                { label: 'Docs vencendo em 30 dias',    value: data?.expiringDocs,      color: 'bg-yellow-100 text-yellow-700' },
                { label: 'Vagas abertas',               value: data?.openJobs,          color: 'bg-blue-100 text-blue-700' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-600">{label}</span>
                  {loading
                    ? <Skeleton className="h-5 w-8" />
                    : <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
                        {value ?? 0}
                      </span>
                  }
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Resumo do mês */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-500" />
              Resumo do mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'Admissões',             value: data?.admissionsThisMonth,   color: 'text-green-600' },
                { label: 'Demissões',             value: data?.terminationsThisMonth, color: 'text-red-600' },
                { label: 'Avaliações realizadas', value: data?.reviewsThisMonth,      color: 'text-blue-600' },
                { label: 'Total de colaboradores',value: data?.totalEmployees,        color: 'text-gray-800' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-600">{label}</span>
                  {loading
                    ? <Skeleton className="h-5 w-6" />
                    : <span className={`text-sm font-semibold ${color}`}>{value ?? 0}</span>
                  }
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Últimas admissões */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" />
            Últimas admissões
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading
            ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            : !data || data.recentEmployees.length === 0
              ? <p className="text-sm text-gray-400 py-4 text-center">Nenhum colaborador cadastrado</p>
              : (
                <div className="divide-y divide-gray-100">
                  {data.recentEmployees.map(emp => (
                    <div key={emp.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{emp.full_name}</p>
                        <p className="text-xs text-gray-400">Admitido em {formatDate(emp.hire_date)}</p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[emp.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[emp.status] ?? emp.status}
                      </span>
                    </div>
                  ))}
                </div>
              )
          }
        </CardContent>
      </Card>
    </div>
  )
}
