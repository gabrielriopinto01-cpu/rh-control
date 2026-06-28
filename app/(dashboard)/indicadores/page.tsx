'use client'

import { useEffect, useState, useCallback } from 'react'
import lazyLoad from 'next/dynamic'
import { BarChart3, TrendingUp, Users, DollarSign, RefreshCw, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const Charts = lazyLoad(() => import('./indicadores-charts'), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[1,2,3,4].map(i => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
    </div>
  ),
})

function monthRef(offset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() - offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthShort(ref: string) {
  const [y, m] = ref.split('-')
  return new Date(+y, +m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' })
}

export interface IndicadoresData {
  // Headcount
  headcountTrend: { month: string; ativos: number; afastados: number }[]
  // Turnover
  turnoverTrend: { month: string; admissoes: number; desligamentos: number; taxa: number }[]
  // Headcount por departamento
  byDept: { dept: string; total: number }[]
  // Distribuição salarial por faixa
  salaryDist: { range: string; count: number }[]
  // Absenteísmo mensal
  absencesTrend: { month: string; faltas: number; atestados: number }[]
  // Folha mensal
  payrollTrend: { month: string; bruto: number; liquido: number }[]
  // KPIs atuais
  avgSalary: number
  medianSalary: number
  totalPayroll: number
  turnoverRate: number
  absenteeismRate: number
}

export default function IndicadoresPage() {
  const { user } = useAuth()
  const [data, setData] = useState<IndicadoresData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user?.company_id) { setLoading(false); return }
    setLoading(true)
    const supabase = createClient()
    const last6    = Array.from({ length: 6 }, (_, i) => monthRef(5 - i))
    const today    = new Date().toISOString().slice(0, 10)
    const monthStart = monthRef(0) + '-01'

    const [empRes, attRes, certRes, payRes, payItemRes] = await Promise.allSettled([
      supabase.from('employees').select('id, status, hire_date, termination_date, salary, department:departments(name)')
        .eq('company_id', user.company_id),
      supabase.from('attendance_records').select('status, date').eq('company_id', user.company_id)
        .gte('date', last6[0] + '-01'),
      supabase.from('medical_certificates').select('days, start_date').eq('company_id', user.company_id)
        .gte('start_date', last6[0] + '-01'),
      supabase.from('payrolls').select('reference, total_gross, total_net').eq('company_id', user.company_id)
        .in('reference', last6),
      supabase.from('payrolls').select('reference, payroll_items(gross_salary, net_salary)').eq('company_id', user.company_id)
        .in('reference', last6),
    ])

    const employees  = (empRes.status  === 'fulfilled' ? empRes.value.data  : null) ?? []
    const attendance = (attRes.status  === 'fulfilled' ? attRes.value.data  : null) ?? []
    const certs      = (certRes.status === 'fulfilled' ? certRes.value.data : null) ?? []
    const payrolls   = (payRes.status  === 'fulfilled' ? payRes.value.data  : null) ?? []

    // Headcount trend
    const headcountTrend = last6.map(m => {
      const mEnd   = m + '-31'
      const mStart = m + '-01'
      const ativos    = employees.filter((e: any) => e.hire_date <= mEnd && (!e.termination_date || e.termination_date > mStart) && e.status !== 'terminated').length
      const afastados = employees.filter((e: any) => e.hire_date <= mEnd && e.status === 'on_leave').length
      return { month: monthShort(m), ativos, afastados }
    })

    // Turnover trend
    const currentActive = employees.filter((e: any) => e.status === 'active').length
    const turnoverTrend = last6.map(m => {
      const mStart = m + '-01'; const mEnd = m + '-31'
      const admissoes    = employees.filter((e: any) => e.hire_date >= mStart && e.hire_date <= mEnd).length
      const desligamentos = employees.filter((e: any) => e.termination_date >= mStart && e.termination_date <= mEnd).length
      const base = employees.filter((e: any) => e.hire_date <= mStart).length || 1
      return { month: monthShort(m), admissoes, desligamentos, taxa: +((desligamentos / base) * 100).toFixed(1) }
    })

    // Headcount por departamento
    const deptMap: Record<string, number> = {}
    for (const e of employees.filter((e: any) => e.status === 'active')) {
      const d = (e.department as any)?.name ?? 'Sem departamento'
      deptMap[d] = (deptMap[d] ?? 0) + 1
    }
    const byDept = Object.entries(deptMap).sort((a,b) => b[1]-a[1]).slice(0,10).map(([dept,total]) => ({ dept, total }))

    // Distribuição salarial
    const salaries = employees.filter((e: any) => e.status === 'active' && e.salary).map((e: any) => e.salary as number)
    const RANGES = [
      { label: 'Até 2k',     min: 0,    max: 2000 },
      { label: '2k–4k',      min: 2000, max: 4000 },
      { label: '4k–6k',      min: 4000, max: 6000 },
      { label: '6k–10k',     min: 6000, max: 10000 },
      { label: '10k–15k',    min: 10000,max: 15000 },
      { label: 'Acima 15k',  min: 15000,max: Infinity },
    ]
    const salaryDist = RANGES.map(r => ({
      range: r.label,
      count: salaries.filter(s => s > r.min && s <= r.max).length,
    }))

    // Absenteísmo trend
    const absencesTrend = last6.map(m => {
      const mStart = m + '-01'; const mEnd = m + '-31'
      const faltas    = attendance.filter((a: any) => a.date >= mStart && a.date <= mEnd && a.status === 'absent').length
      const atestados = certs.filter((c: any) => c.start_date >= mStart && c.start_date <= mEnd).length
      return { month: monthShort(m), faltas, atestados }
    })

    // Folha trend
    const payrollMap = Object.fromEntries(payrolls.map((p: any) => [p.reference, { bruto: p.total_gross ?? 0, liquido: p.total_net ?? 0 }]))
    const payrollTrend = last6.map(m => ({
      month: monthShort(m),
      bruto:   payrollMap[m]?.bruto   ?? 0,
      liquido: payrollMap[m]?.liquido ?? 0,
    }))

    // KPIs
    const avg    = salaries.length ? salaries.reduce((s,v) => s+v, 0) / salaries.length : 0
    const sorted = [...salaries].sort((a,b) => a-b)
    const median = sorted.length ? (sorted.length % 2 === 0 ? (sorted[sorted.length/2-1]+sorted[sorted.length/2])/2 : sorted[Math.floor(sorted.length/2)]) : 0
    const totalPay   = payrolls.find((p: any) => p.reference === monthRef(0))
    const lastMonth  = turnoverTrend[turnoverTrend.length - 1]
    const lastAbsent = absencesTrend[absencesTrend.length - 1]

    setData({
      headcountTrend, turnoverTrend, byDept, salaryDist, absencesTrend, payrollTrend,
      avgSalary:       +avg.toFixed(2),
      medianSalary:    +median.toFixed(2),
      totalPayroll:    (totalPay as any)?.total_net ?? 0,
      turnoverRate:    lastMonth?.taxa ?? 0,
      absenteeismRate: currentActive > 0 ? +((lastAbsent.faltas + lastAbsent.atestados) / (currentActive * 22) * 100).toFixed(1) : 0,
    })
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" /> Indicadores de RH
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Análise histórica e métricas estratégicas — últimos 6 meses</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        {[
          { label: 'Salário médio',    value: data ? formatCurrency(data.avgSalary)    : null, icon: DollarSign,  color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Salário mediano',  value: data ? formatCurrency(data.medianSalary) : null, icon: DollarSign,  color: 'text-teal-600',   bg: 'bg-teal-50' },
          { label: 'Folha do mês',     value: data ? formatCurrency(data.totalPayroll) : null, icon: DollarSign,  color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Turnover (mês)',   value: data ? `${data.turnoverRate}%`           : null, icon: TrendingUp,  color: 'text-red-600',    bg: 'bg-red-50' },
          { label: 'Absenteísmo',      value: data ? `${data.absenteeismRate}%`        : null, icon: Users,       color: 'text-amber-600',  bg: 'bg-amber-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white border rounded-xl p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${bg} shrink-0`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              {loading ? <Skeleton className="h-6 w-20 mt-1" /> : <p className={`text-lg font-bold ${color}`}>{value ?? '—'}</p>}
            </div>
          </div>
        ))}
      </div>

      {!loading && data ? (
        <Charts data={data} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
        </div>
      )}
    </div>
  )
}
