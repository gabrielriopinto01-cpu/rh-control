'use client'

import { useEffect, useState, useCallback } from 'react'
import { Clock, TrendingUp, TrendingDown, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useMyEmployee } from '@/hooks/use-my-employee'
import { formatDate } from '@/lib/utils'
import type { AttendanceRecord } from '@/types/database'

export const dynamic = 'force-dynamic'

function formatHours(h: number) {
  const abs = Math.abs(h)
  const hrs = Math.floor(abs)
  const min = Math.round((abs - hrs) * 60)
  const sign = h < 0 ? '-' : '+'
  return `${sign}${hrs}h${min > 0 ? `${String(min).padStart(2, '0')}m` : ''}`
}

function formatHoursAbs(h: number) {
  const hrs = Math.floor(Math.abs(h))
  const min = Math.round((Math.abs(h) - hrs) * 60)
  return `${hrs}h${min > 0 ? `${String(min).padStart(2, '0')}m` : ''}`
}

export default function BancoHorasPage() {
  const { user }                          = useAuth()
  const { employee, loading: empLoading } = useMyEmployee()

  const today = new Date()
  const [year,    setYear]    = useState(today.getFullYear())
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user || !employee) { setLoading(false); return }
    const supabase = createClient()
    const start = `${year}-01-01`
    const end   = `${year}-12-31`
    const { data } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('company_id', user.company_id)
      .eq('employee_id', employee.id)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
    setRecords(data ?? [])
    setLoading(false)
  }, [user, employee, year])

  useEffect(() => { load() }, [load] )

  // Agrupa por mês e calcula banco
  const monthlyData = Array.from({ length: 12 }, (_, m) => {
    const monthRecs = records.filter(r => new Date(r.date).getMonth() === m)
    const totalHours  = monthRecs.reduce((s, r) => s + (r.total_hours ?? 0), 0)
    const overtime    = monthRecs.reduce((s, r) => s + (r.overtime   ?? 0), 0)
    const workDays    = monthRecs.filter(r => r.status === 'present' || r.status === 'late').length
    const absences    = monthRecs.filter(r => r.status === 'absent').length
    const expectedHrs = workDays * 8
    const balance     = totalHours - expectedHrs
    return { month: m, totalHours, overtime, workDays, absences, balance, count: monthRecs.length }
  })

  const totalOvertime  = records.reduce((s, r) => s + (r.overtime ?? 0), 0)
  const totalHours     = records.reduce((s, r) => s + (r.total_hours ?? 0), 0)
  const totalAbsences  = records.filter(r => r.status === 'absent').length
  const totalWorkDays  = records.filter(r => r.status === 'present' || r.status === 'late').length
  const expectedTotal  = totalWorkDays * 8
  const balanceTotal   = totalHours - expectedTotal

  const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

  if (empLoading) return <div className="p-8 text-center text-gray-400">Carregando...</div>

  if (!employee) return (
    <div className="p-12 text-center">
      <AlertCircle className="h-10 w-10 text-yellow-400 mx-auto mb-3" />
      <p className="font-semibold text-gray-700">Perfil de funcionário não encontrado</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banco de Horas</h1>
          <p className="text-gray-500 mt-1">{employee.full_name}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setYear(y => y - 1)} className="p-1.5 rounded-md hover:bg-gray-100"><ChevronLeft className="h-5 w-5" /></button>
          <span className="font-semibold text-gray-800 w-16 text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="p-1.5 rounded-md hover:bg-gray-100"><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>

      {/* Totais do ano */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total de horas',  value: formatHoursAbs(totalHours),   color: 'text-blue-700',   bg: 'bg-blue-50',   icon: Clock },
          { label: 'Horas extras',    value: formatHoursAbs(totalOvertime), color: 'text-purple-700', bg: 'bg-purple-50', icon: TrendingUp },
          { label: 'Faltas',          value: `${totalAbsences}d`,           color: 'text-red-600',    bg: 'bg-red-50',    icon: TrendingDown },
          { label: 'Saldo banco',     value: formatHours(balanceTotal),     color: balanceTotal >= 0 ? 'text-green-700' : 'text-red-600', bg: balanceTotal >= 0 ? 'bg-green-50' : 'bg-red-50', icon: Clock },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className={`${bg} rounded-xl p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`h-4 w-4 ${color}`} />
              <p className="text-xs text-gray-500">{label}</p>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Gráfico de barras simples por mês */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-6">Horas extras por mês</h2>
        {loading ? (
          <div className="text-center text-gray-400 py-8">Carregando...</div>
        ) : (
          <div className="flex items-end gap-2 h-32">
            {monthlyData.map(d => {
              const maxOT = Math.max(...monthlyData.map(x => x.overtime), 1)
              const pct   = (d.overtime / maxOT) * 100
              return (
                <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-purple-600 font-medium">{d.overtime > 0 ? `${Math.floor(d.overtime)}h` : ''}</span>
                  <div className="w-full rounded-t-md bg-purple-100 relative" style={{ height: '80px' }}>
                    <div
                      className="absolute bottom-0 w-full bg-purple-500 rounded-t-md transition-all"
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{monthNames[d.month]}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Tabela por mês */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Mês','Dias trabalhados','Faltas','Total horas','Horas extras','Saldo'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {monthlyData.map(d => {
              const isCurrentMonth = d.month === today.getMonth() && year === today.getFullYear()
              return (
                <tr key={d.month} className={`hover:bg-gray-50 ${isCurrentMonth ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {monthNames[d.month]}
                    {isCurrentMonth && <span className="ml-2 text-xs text-blue-500">(atual)</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{d.workDays}d</td>
                  <td className="px-4 py-3 text-red-500">{d.absences > 0 ? `${d.absences}d` : '—'}</td>
                  <td className="px-4 py-3 text-blue-700 font-medium">{d.totalHours > 0 ? formatHoursAbs(d.totalHours) : '—'}</td>
                  <td className="px-4 py-3 text-purple-600">{d.overtime > 0 ? `+${formatHoursAbs(d.overtime)}` : '—'}</td>
                  <td className={`px-4 py-3 font-semibold ${d.count === 0 ? 'text-gray-300' : d.balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {d.count === 0 ? '—' : formatHours(d.balance)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
