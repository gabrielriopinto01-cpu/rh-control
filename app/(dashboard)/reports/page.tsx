'use client'

import { useEffect, useState, useCallback } from 'react'
import { BarChart2, DollarSign, Palmtree, Star, Briefcase, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const STATUS_PT: Record<string, string> = {
  active: 'Ativo', inactive: 'Inativo', on_leave: 'Afastado', terminated: 'Desligado',
}
const CONTRACT_PT: Record<string, string> = {
  clt: 'CLT', pj: 'PJ', estagio: 'Estágio', temporario: 'Temporário',
}
const VACATION_PT: Record<string, string> = {
  pending: 'Pendente', approved: 'Aprovado', rejected: 'Recusado', taken: 'Usufruído',
}

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

interface ReportData {
  empByStatus:   { name: string; value: number }[]
  empByContract: { name: string; value: number }[]
  empByDept:     { name: string; count: number }[]
  vacationsByStatus: { name: string; value: number }[]
  payrollByMonth: { month: string; bruto: number; liquido: number }[]
  avgScore: number | null
  openJobs: number
  hiredCandidates: number
  rawEmployees: { full_name: string; cpf: string; hire_date: string; status: string; contract_type: string; salary: number }[]
}

function monthLabel(ref: string) {
  const [y, m] = ref.split('-')
  return new Date(+y, +m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

function exportCSV(data: ReportData['rawEmployees']) {
  const header = 'Nome,CPF,Admissão,Status,Contrato,Salário'
  const rows = data.map(e =>
    `"${e.full_name}","${e.cpf}","${e.hire_date}","${STATUS_PT[e.status] ?? e.status}","${CONTRACT_PT[e.contract_type] ?? e.contract_type}","${e.salary}"`
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `colaboradores_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportPayrollCSV(data: ReportData['payrollByMonth']) {
  const header = 'Mês,Bruto,Líquido'
  const rows = data.map(p => `"${p.month}","${p.bruto}","${p.liquido}"`)
  const csv  = [header, ...rows].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `folha_pagamento_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const { user } = useAuth()
  const [data,       setData]       = useState<ReportData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()))

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    setLoading(true)
    const supabase = createClient()

    const [empRes, deptRes, vacRes, payRes, perfRes, jobRes, candRes] = await Promise.all([
      supabase.from('employees').select('full_name, cpf, hire_date, status, contract_type, salary, department_id')
        .eq('company_id', user.company_id),
      supabase.from('departments').select('id, name').eq('company_id', user.company_id),
      supabase.from('vacations').select('status').eq('company_id', user.company_id),
      supabase.from('payrolls').select('reference_month, total_net, total_gross')
        .eq('company_id', user.company_id)
        .gte('reference_month', `${yearFilter}-01`)
        .lte('reference_month', `${yearFilter}-12`)
        .order('reference_month'),
      supabase.from('performance_reviews').select('score').eq('company_id', user.company_id).not('score', 'is', null),
      supabase.from('job_openings').select('status').eq('company_id', user.company_id),
      supabase.from('candidates').select('stage'),
    ])

    const emps  = empRes.data  ?? []
    const depts = deptRes.data ?? []
    const vacs  = vacRes.data  ?? []
    const pays  = payRes.data  ?? []
    const perfs = perfRes.data ?? []
    const jobs  = jobRes.data  ?? []
    const cands = candRes.data ?? []

    const byStatus:   Record<string, number> = {}
    const byContract: Record<string, number> = {}
    const byDeptMap:  Record<string, number> = {}
    for (const e of emps) {
      byStatus[e.status]         = (byStatus[e.status]         ?? 0) + 1
      byContract[e.contract_type]= (byContract[e.contract_type]?? 0) + 1
      if (e.department_id) byDeptMap[e.department_id] = (byDeptMap[e.department_id] ?? 0) + 1
    }

    const byVac: Record<string, number> = {}
    for (const v of vacs) byVac[v.status] = (byVac[v.status] ?? 0) + 1

    const scores = perfs.map(p => p.score as number)
    const avgScore = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : null

    setData({
      empByStatus:   Object.entries(byStatus).map(([k, v]) => ({ name: STATUS_PT[k] ?? k, value: v })),
      empByContract: Object.entries(byContract).map(([k, v]) => ({ name: CONTRACT_PT[k] ?? k, value: v })),
      empByDept:     depts.map(d => ({ name: d.name, count: byDeptMap[d.id] ?? 0 }))
        .filter(d => d.count > 0).sort((a, b) => b.count - a.count).slice(0, 8),
      vacationsByStatus: Object.entries(byVac).map(([k, v]) => ({ name: VACATION_PT[k] ?? k, value: v })),
      payrollByMonth: pays.map(p => ({ month: monthLabel(p.reference_month), bruto: p.total_gross, liquido: p.total_net })),
      avgScore,
      openJobs:        jobs.filter(j => j.status === 'open').length,
      hiredCandidates: cands.filter(c => c.stage === 'hired').length,
      rawEmployees: emps.map(e => ({
        full_name: e.full_name, cpf: e.cpf, hire_date: e.hire_date,
        status: e.status, contract_type: e.contract_type, salary: e.salary,
      })),
    })
    setLoading(false)
  }, [user, yearFilter])

  useEffect(() => { load() }, [load])

  const years = Array.from({ length: 4 }, (_, i) => String(new Date().getFullYear() - i))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-500 mt-1">Indicadores e análises de RH</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select defaultValue={yearFilter} onValueChange={(v) => setYearFilter(v ?? yearFilter)}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" disabled={!data || loading}
            onClick={() => data && exportCSV(data.rawEmployees)}>
            <Download className="h-4 w-4 mr-1.5" />Colaboradores CSV
          </Button>
          <Button variant="outline" size="sm" disabled={!data || loading || data.payrollByMonth.length === 0}
            onClick={() => data && exportPayrollCSV(data.payrollByMonth)}>
            <Download className="h-4 w-4 mr-1.5" />Folha CSV
          </Button>
        </div>
      </div>

      {/* Status + Contrato (Pie) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-blue-500" />
              Colaboradores por status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-48 w-full" /> : (
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={data?.empByStatus ?? []} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}>
                    {data?.empByStatus.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-purple-500" />
              Colaboradores por contrato
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-48 w-full" /> : (
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={data?.empByContract ?? []} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}>
                    {data?.empByContract.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Por departamento */}
      {(!loading && data && data.empByDept.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-teal-500" />
              Colaboradores por departamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.empByDept} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} />
                <Tooltip formatter={(v) => [Number(v ?? 0), 'Colaboradores']} />
                <Bar dataKey="count" fill="#14b8a6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Folha mensal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            Folha de pagamento — {yearFilter}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-56 w-full" /> :
            !data || data.payrollByMonth.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">Nenhuma folha gerada em {yearFilter}</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.payrollByMonth} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v === 0 ? '0' : `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => [formatCurrency(Number(v ?? 0))]} />
                  <Legend />
                  <Bar dataKey="bruto"   name="Bruto"   fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="liquido" name="Líquido" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </CardContent>
      </Card>

      {/* Férias + Recrutamento + Desempenho */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Palmtree className="h-4 w-4 text-yellow-500" />
              Férias por status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-48 w-full" /> : (
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={data?.vacationsByStatus ?? []} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={60}>
                    {data?.vacationsByStatus.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-indigo-500" />
              Recrutamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {loading ? <Skeleton className="h-24 w-full" /> : (
              <>
                <div className="text-center py-2">
                  <p className="text-4xl font-bold text-indigo-600">{data?.openJobs ?? 0}</p>
                  <p className="text-sm text-gray-500 mt-1">Vagas abertas</p>
                </div>
                <div className="text-center py-2 border-t border-gray-100">
                  <p className="text-4xl font-bold text-green-600">{data?.hiredCandidates ?? 0}</p>
                  <p className="text-sm text-gray-500 mt-1">Contratados</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              Nota média de desempenho
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-24 w-full" /> : (
              <div className="text-center py-6">
                <p className="text-5xl font-bold text-yellow-500">
                  {data?.avgScore != null ? data.avgScore.toFixed(1) : '—'}
                </p>
                <p className="text-sm text-gray-500 mt-2">de 5.0</p>
                {data?.avgScore != null && (
                  <div className="flex justify-center gap-1 mt-3">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className={`h-2.5 w-8 rounded-full ${i <= Math.round(data.avgScore ?? 0) ? 'bg-yellow-400' : 'bg-gray-200'}`} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
