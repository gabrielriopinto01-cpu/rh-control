'use client'

import { useEffect, useState, useCallback } from 'react'
import { GraduationCap, CheckCircle2, AlertCircle, Clock, Download, Search, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export const dynamic = 'force-dynamic'

type Training = { id: string; title: string; is_mandatory: boolean }
type Employee = { id: string; full_name: string; position: string | null; department: { name: string } | null }
type Completion = { employee_id: string; training_id: string; completed_at: string }

type CellStatus = 'done' | 'pending' | 'not_required'

export default function ConformidadeTreinamentosPage() {
  const { user } = useAuth()
  const [trainings,   setTrainings]   = useState<Training[]>([])
  const [employees,   setEmployees]   = useState<Employee[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [filterDept,  setFilterDept]  = useState('')
  const [onlyPending, setOnlyPending] = useState(false)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user?.company_id) { setLoading(false); return }
    setLoading(true)
    const supabase = createClient()
    const [trRes, empRes, compRes] = await Promise.all([
      supabase.from('trainings').select('id, title, is_mandatory, is_active')
        .eq('company_id', user.company_id).eq('is_active', true).order('title'),
      supabase.from('employees').select('id, full_name, position, department:departments(name)')
        .eq('company_id', user.company_id).eq('status', 'active').order('full_name'),
      supabase.from('training_completions').select('employee_id, training_id, completed_at')
        .eq('company_id', user.company_id),
    ])
    setTrainings((trRes.data ?? []) as Training[])
    setEmployees((empRes.data ?? []) as unknown as Employee[])
    setCompletions((compRes.data ?? []) as Completion[])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const mandatoryTrainings = trainings.filter(t => t.is_mandatory)
  const allTrainings = trainings  // exibe todos, mas destaca obrigatórios

  // Mapa de conclusões: employee_id+training_id → completion
  const compMap = new Map(completions.map(c => [`${c.employee_id}:${c.training_id}`, c]))

  function getStatus(empId: string, trId: string): CellStatus {
    return compMap.has(`${empId}:${trId}`) ? 'done' : 'pending'
  }

  // Filtros
  const depts = Array.from(new Set(employees.map(e => (e.department as any)?.name).filter(Boolean))).sort()
  const filtered = employees.filter(e => {
    if (search && !e.full_name.toLowerCase().includes(search.toLowerCase())) return false
    if (filterDept && (e.department as any)?.name !== filterDept) return false
    if (onlyPending) {
      const hasPending = mandatoryTrainings.some(t => getStatus(e.id, t.id) === 'pending')
      if (!hasPending) return false
    }
    return true
  })

  // KPIs
  const totalRequired   = mandatoryTrainings.length * employees.length
  const totalDone       = mandatoryTrainings.reduce((s, t) => s + employees.filter(e => getStatus(e.id, t.id) === 'done').length, 0)
  const compliancePct   = totalRequired > 0 ? Math.round((totalDone / totalRequired) * 100) : 100
  const empCompliant    = employees.filter(e => mandatoryTrainings.every(t => getStatus(e.id, t.id) === 'done')).length
  const empNonCompliant = employees.length - empCompliant

  function exportCSV() {
    const header = ['Colaborador', 'Cargo', 'Departamento', ...allTrainings.map(t => t.title), 'Conformidade (%)']
    const rows = employees.map(e => {
      const done  = mandatoryTrainings.filter(t => getStatus(e.id, t.id) === 'done').length
      const total = mandatoryTrainings.length
      const pct   = total > 0 ? Math.round((done / total) * 100) : 100
      return [
        e.full_name,
        e.position ?? '',
        (e.department as any)?.name ?? '',
        ...allTrainings.map(t => getStatus(e.id, t.id) === 'done' ? 'Concluído' : 'Pendente'),
        `${pct}%`,
      ]
    })
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const a   = document.createElement('a')
    a.href    = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `conformidade-treinamentos_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  async function markDone(empId: string, trId: string) {
    if (!isSupabaseConfigured() || !user?.company_id) return
    const supabase = createClient()
    const key = `${empId}:${trId}`
    if (compMap.has(key)) {
      // Desmarcar
      const { error } = await supabase.from('training_completions').delete()
        .eq('employee_id', empId).eq('training_id', trId).eq('company_id', user.company_id)
      if (error) { toast.error('Erro ao remover conclusão'); return }
      setCompletions(prev => prev.filter(c => !(c.employee_id === empId && c.training_id === trId)))
    } else {
      // Marcar como concluído
      const { data, error } = await supabase.from('training_completions').insert({
        company_id: user.company_id, employee_id: empId, training_id: trId,
        completed_at: new Date().toISOString(), completed_by: user.id,
      }).select().single()
      if (error) { toast.error('Erro ao registrar conclusão'); return }
      if (data) setCompletions(prev => [...prev, data as Completion])
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6" /> Conformidade de Treinamentos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Matriz de conclusão — {mandatoryTrainings.length} treinamento(s) obrigatório(s)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`rounded-xl border p-4 ${compliancePct >= 90 ? 'bg-green-50 border-green-100' : compliancePct >= 70 ? 'bg-yellow-50 border-yellow-100' : 'bg-red-50 border-red-100'}`}>
          <p className="text-xs uppercase tracking-wide text-gray-400">Conformidade geral</p>
          <p className={`text-3xl font-bold mt-1 ${compliancePct >= 90 ? 'text-green-600' : compliancePct >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
            {compliancePct}%
          </p>
          <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${compliancePct >= 90 ? 'bg-green-500' : compliancePct >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${compliancePct}%` }} />
          </div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Em dia</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{empCompliant}</p>
          <p className="text-xs text-gray-400 mt-0.5">colaborador(es) conformes</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Com pendências</p>
          <p className={`text-3xl font-bold mt-1 ${empNonCompliant > 0 ? 'text-red-500' : 'text-gray-400'}`}>{empNonCompliant}</p>
          <p className="text-xs text-gray-400 mt-0.5">colaborador(es) pendentes</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Conclusões</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{totalDone}<span className="text-base text-gray-400">/{totalRequired}</span></p>
          <p className="text-xs text-gray-400 mt-0.5">de {totalRequired} esperadas</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filtrar colaborador..." className="pl-8 h-8 text-sm w-48" />
        </div>
        {depts.length > 0 && (
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm bg-background h-8">
            <option value="">Todos os deptos</option>
            {depts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={onlyPending} onChange={e => setOnlyPending(e.target.checked)} className="rounded" />
          Só com pendências
        </label>
      </div>

      {/* Matriz */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : allTrainings.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-400">
          <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhum treinamento cadastrado</p>
          <p className="text-sm mt-1">Cadastre treinamentos em <a href="/treinamentos" className="text-blue-500 hover:underline">Treinamentos</a></p>
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse min-w-full">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="text-left px-4 py-3 min-w-48 sticky left-0 bg-slate-800 z-10 border-r border-slate-700">
                    Colaborador
                  </th>
                  {allTrainings.map(t => (
                    <th key={t.id} className="px-3 py-3 text-center min-w-28">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs leading-tight">{t.title}</span>
                        {t.is_mandatory && (
                          <span className="text-[10px] bg-red-500 text-white px-1.5 rounded-full">Obrig.</span>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center min-w-20 text-xs">Conformidade</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={allTrainings.length + 2} className="text-center py-10 text-gray-400">
                      Nenhum colaborador encontrado
                    </td>
                  </tr>
                ) : filtered.map((e, ri) => {
                  const mandDone  = mandatoryTrainings.filter(t => getStatus(e.id, t.id) === 'done').length
                  const mandTotal = mandatoryTrainings.length
                  const pct       = mandTotal > 0 ? Math.round((mandDone / mandTotal) * 100) : 100
                  const isCompliant = pct === 100

                  return (
                    <tr key={e.id} className={`border-b ${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50/40 transition-colors`}>
                      <td className={`px-4 py-2.5 sticky left-0 z-10 border-r ${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50/40`}>
                        <p className="font-medium text-gray-900">{e.full_name}</p>
                        <p className="text-xs text-gray-400 truncate max-w-40">
                          {e.position ?? '-'}{(e.department as any)?.name ? ` · ${(e.department as any).name}` : ''}
                        </p>
                      </td>
                      {allTrainings.map(t => {
                        const status = getStatus(e.id, t.id)
                        return (
                          <td key={t.id} className="px-3 py-2 text-center">
                            <button
                              onClick={() => markDone(e.id, t.id)}
                              title={status === 'done' ? 'Clique para desmarcar' : 'Clique para marcar como concluído'}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg hover:scale-110 transition-transform"
                            >
                              {status === 'done'
                                ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                                : t.is_mandatory
                                  ? <AlertCircle className="h-5 w-5 text-red-400" />
                                  : <Clock className="h-5 w-5 text-gray-300" />
                              }
                            </button>
                          </td>
                        )
                      })}
                      <td className="px-3 py-2 text-center">
                        <span className={`text-xs font-bold ${isCompliant ? 'text-green-600' : pct >= 70 ? 'text-yellow-600' : 'text-red-500'}`}>
                          {pct}%
                        </span>
                        <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden w-12 mx-auto">
                          <div className={`h-full rounded-full ${isCompliant ? 'bg-green-500' : pct >= 70 ? 'bg-yellow-400' : 'bg-red-400'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-400 flex items-center gap-4">
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Concluído</span>
            <span className="flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5 text-red-400" /> Pendente (obrigatório)</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-gray-300" /> Pendente (opcional)</span>
            <span className="ml-auto">Clique na célula para alternar conclusão</span>
          </div>
        </div>
      )}
    </div>
  )
}
