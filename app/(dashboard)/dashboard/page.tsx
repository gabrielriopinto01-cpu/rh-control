'use client'

import { useEffect, useState, useCallback } from 'react'
import { Users, DollarSign, TrendingUp, UserCheck, AlertCircle, Palmtree, Briefcase } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency, formatDate } from '@/lib/utils'

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
  recentEmployees: { id: string; full_name: string; hire_date: string; status: string }[]
  headcountByMonth: { month: string; total: number }[]
  payrollTrend: { month: string; liquido: number }[]
  empByStatus: { name: string; value: number }[]
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

    const [empRes, vacRes, docRes, jobRes, payRes, payTrendRes, reviewRes] = await Promise.all([
      supabase.from('employees').select('id, full_name, hire_date, termination_date, status')
        .eq('company_id', user.company_id).order('hire_date', { ascending: false }),
      supabase.from('vacations').select('id, status').eq('company_id', user.company_id),
      supabase.from('documents').select('id, expires_at').eq('company_id', user.company_id),
      supabase.from('job_openings').select('id, status').eq('company_id', user.company_id),
      supabase.from('payrolls').select('total_net').eq('company_id', user.company_id)
        .eq('reference_month', refMonth).maybeSingle(),
      supabase.from('payrolls').select('reference_month, total_net').eq('company_id', user.company_id)
        .in('reference_month', last6).order('reference_month'),
      supabase.from('performance_reviews').select('id, created_at').eq('company_id', user.company_id),
    ])

    const employees = empRes.data ?? []
    const vacations = vacRes.data ?? []
    const docs      = docRes.data ?? []
    const jobs      = jobRes.data ?? []
    const reviews   = reviewRes.data ?? []
    const payTrend  = payTrendRes.data ?? []

    const activeEmps    = employees.filter(e => e.status === 'active')
    const expiringDocs  = docs.filter(d => d.expires_at && d.expires_at >= today && d.expires_at <= in30days).length
    const admissions    = employees.filter(e => e.hire_date >= monthStart).length
    const terminations  = employees.filter(e => e.termination_date && e.termination_date >= monthStart).length
    const reviewsMonth  = reviews.filter(r => r.created_at >= monthStart).length

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

    setData({
      activeEmployees:       activeEmps.length,
      totalEmployees:        employees.length,
      pendingVacations:      vacations.filter(v => v.status === 'pending').length,
      expiringDocs,
      openJobs:              jobs.filter(j => j.status === 'open').length,
      currentPayrollNet:     payRes.data?.total_net ?? null,
      admissionsThisMonth:   admissions,
      terminationsThisMonth: terminations,
      reviewsThisMonth:      reviewsMonth,
      recentEmployees:       employees.slice(0, 5).map(e => ({
        id: e.id, full_name: e.full_name, hire_date: e.hire_date, status: e.status,
      })),
      headcountByMonth,
      payrollTrend,
      empByStatus,
    })
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
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

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Headcount últimos 6 meses */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Headcount — últimos 6 meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading
              ? <Skeleton className="h-48 w-full" />
              : (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={data?.headcountByMonth ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip formatter={(v) => [Number(v ?? 0), 'Colaboradores']} />
                    <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2}
                      fill="url(#colorTotal)" dot={{ r: 3, fill: '#3b82f6' }} />
                  </AreaChart>
                </ResponsiveContainer>
              )
            }
          </CardContent>
        </Card>

        {/* Folha mensal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              Folha líquida — últimos 6 meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading
              ? <Skeleton className="h-48 w-full" />
              : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data?.payrollTrend ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v === 0 ? '0' : `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => [formatCurrency(Number(v ?? 0)), 'Líquido']} />
                    <Bar dataKey="liquido" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )
            }
          </CardContent>
        </Card>
      </div>

      {/* Status + Resumo do mês + Pendências */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribuição por status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Por status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading
              ? <Skeleton className="h-40 w-full" />
              : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={data?.empByStatus ?? []} layout="vertical"
                    margin={{ top: 0, right: 8, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={72} />
                    <Tooltip formatter={(v) => [Number(v ?? 0), 'Colaboradores']} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {data?.empByStatus.map((_, i) => (
                        <rect key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )
            }
          </CardContent>
        </Card>

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
                { label: 'Férias aguardando aprovação', value: data?.pendingVacations, color: 'bg-orange-100 text-orange-700' },
                { label: 'Docs vencendo em 30 dias',    value: data?.expiringDocs,     color: 'bg-yellow-100 text-yellow-700' },
                { label: 'Vagas abertas',               value: data?.openJobs,         color: 'bg-blue-100 text-blue-700' },
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
