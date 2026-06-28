'use client'

import { useEffect, useState, useCallback } from 'react'
import { CalendarCheck, ChevronLeft, ChevronRight, Loader2, CheckCircle2, Lock, RotateCcw, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import type { AttendanceRecord, Employee, TimeBankClosure } from '@/types/database'

export const dynamic = 'force-dynamic'

const EXPECTED_PER_DAY = 8

function formatHours(h: number) {
  const sign = h < 0 ? '-' : ''
  const abs = Math.abs(h)
  const hrs = Math.floor(abs)
  const min = Math.round((abs - hrs) * 60)
  return `${sign}${hrs}h${min > 0 ? `${String(min).padStart(2, '0')}m` : ''}`
}

type Row = {
  employee: Employee
  worked: number
  overtime: number
  balance: number
  closure: TimeBankClosure | null
}

export default function FechamentoPontoPage() {
  const { user } = useAuth()
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [rows,    setRows]    = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busy,    setBusy]    = useState<string | null>(null)

  const refMonth = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthLabel = new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    setLoading(true)
    const supabase = createClient()
    const start = `${refMonth}-01`
    const end   = `${refMonth}-31`
    const [eRes, aRes, cRes] = await Promise.all([
      supabase.from('employees').select('*').eq('company_id', user.company_id).eq('status', 'active').order('full_name'),
      supabase.from('attendance_records').select('*').eq('company_id', user.company_id).gte('date', start).lte('date', end),
      supabase.from('time_bank_closures').select('*').eq('company_id', user.company_id).eq('reference_month', refMonth),
    ])
    const employees = (eRes.data as Employee[]) ?? []
    const records   = (aRes.data as AttendanceRecord[]) ?? []
    const closures  = (cRes.data as TimeBankClosure[]) ?? []

    const built: Row[] = employees.map(emp => {
      const recs = records.filter(r => r.employee_id === emp.id)
      const worked   = recs.reduce((s, r) => s + (r.total_hours ?? 0), 0)
      const overtime = recs.reduce((s, r) => s + (r.overtime ?? 0), 0)
      const daysWithRecord = recs.filter(r => r.total_hours != null).length
      const balance  = +(worked - daysWithRecord * EXPECTED_PER_DAY).toFixed(2)
      return { employee: emp, worked, overtime, balance, closure: closures.find(c => c.employee_id === emp.id) ?? null }
    })
    setRows(built)
    setLoading(false)
  }, [user, refMonth])

  useEffect(() => { load() }, [load])

  const upsertClosure = async (row: Row, status: 'pending' | 'approved') => {
    if (!isSupabaseConfigured() || !user) return
    setBusy(row.employee.id)
    const supabase = createClient()
    const payload = {
      company_id: user.company_id, employee_id: row.employee.id, reference_month: refMonth,
      worked_hours: row.worked, overtime_hours: row.overtime, balance_hours: row.balance,
      status,
      approved_by: status === 'approved' ? user.id : null,
      approved_at: status === 'approved' ? new Date().toISOString() : null,
      created_by: user.id,
    }
    const { error } = await supabase.from('time_bank_closures').upsert(payload, { onConflict: 'employee_id,reference_month' })
    setBusy(null)
    if (error) { toast.error('Erro ao salvar fechamento'); return }
    toast.success(status === 'approved' ? 'Fechamento aprovado!' : 'Mês fechado (pendente de aprovação)')
    load()
  }

  const reopen = async (row: Row) => {
    if (!row.closure) return
    setBusy(row.employee.id)
    const supabase = createClient()
    const { error } = await supabase.from('time_bank_closures').delete().eq('id', row.closure.id)
    setBusy(null)
    if (error) { toast.error('Erro ao reabrir'); return }
    toast.success('Fechamento reaberto')
    load()
  }

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  const approvedCount = rows.filter(r => r.closure?.status === 'approved').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fechamento de Ponto</h1>
        <p className="text-gray-500 mt-1">Banco de horas mensal e aprovação</p>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-gray-100"><ChevronLeft className="h-5 w-5" /></button>
        <span className="font-semibold text-gray-800 capitalize w-52 text-center">{monthLabel}</span>
        <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-gray-100"><ChevronRight className="h-5 w-5" /></button>
        <span className="ml-auto text-sm text-gray-400">{approvedCount}/{rows.length} aprovados</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400">Carregando...</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarCheck className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Nenhum colaborador ativo</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Colaborador','Horas trab.','Extras','Saldo','Status','Ações'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(row => {
                const c = row.closure
                return (
                  <tr key={row.employee.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.employee.full_name}</td>
                    <td className="px-4 py-3 text-gray-600">{formatHours(row.worked)}</td>
                    <td className="px-4 py-3 text-purple-600">{row.overtime > 0 ? `+${formatHours(row.overtime)}` : '—'}</td>
                    <td className={`px-4 py-3 font-semibold ${row.balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatHours(row.balance)}</td>
                    <td className="px-4 py-3">
                      {!c ? <span className="text-xs text-gray-400">Aberto</span>
                        : c.status === 'approved'
                          ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700"><CheckCircle2 className="h-3 w-3" /> Aprovado</span>
                          : <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><Lock className="h-3 w-3" /> Fechado</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {busy === row.employee.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        ) : !c ? (
                          <>
                            <button onClick={() => upsertClosure(row, 'approved')} className="text-xs px-2 py-1 rounded hover:bg-green-50 text-green-600">Fechar e aprovar</button>
                            <button onClick={() => upsertClosure(row, 'pending')} className="text-xs px-2 py-1 rounded hover:bg-amber-50 text-amber-600">Fechar</button>
                          </>
                        ) : c.status === 'pending' ? (
                          <>
                            <button onClick={() => upsertClosure(row, 'approved')} className="text-xs px-2 py-1 rounded hover:bg-green-50 text-green-600">Aprovar</button>
                            <button onClick={() => reopen(row)} className="text-xs px-2 py-1 rounded hover:bg-gray-100 text-gray-500">Reabrir</button>
                          </>
                        ) : (
                          <button onClick={() => reopen(row)} className="text-xs px-2 py-1 rounded hover:bg-gray-100 text-gray-500"><RotateCcw className="h-3.5 w-3.5 inline mr-1" />Reabrir</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400 flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" /> Saldo = horas trabalhadas − ({EXPECTED_PER_DAY}h × dias com registro).
      </p>
    </div>
  )
}
