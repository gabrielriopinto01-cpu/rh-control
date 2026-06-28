'use client'

import { useEffect, useState, useCallback } from 'react'
import { Clock, TrendingUp, TrendingDown, Plus, Search, Download, AlertCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type EmpHours = {
  id: string
  full_name: string
  position: string | null
  department: { name: string } | null
  saldo: number       // horas (positivo = crédito, negativo = débito)
  entries: Entry[]
}

type Entry = {
  id: string
  employee_id: string
  date: string
  type: 'credit' | 'debit' | 'compensated'
  hours: number
  description: string
  created_at: string
}

function fmtHours(h: number, showSign = true) {
  const abs  = Math.abs(h)
  const hrs  = Math.floor(abs)
  const min  = Math.round((abs - hrs) * 60)
  const sign = showSign ? (h >= 0 ? '+' : '-') : ''
  return `${sign}${hrs}h${min > 0 ? String(min).padStart(2, '0') + 'm' : ''}`
}

function monthRef(offset = 0) {
  const d = new Date(); d.setMonth(d.getMonth() - offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(ref: string) {
  const [y, m] = ref.split('-')
  return new Date(+y, +m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export default function BancoHorasEquipePage() {
  const { user } = useAuth()

  const [empHours,  setEmpHours]  = useState<EmpHours[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [monthIdx,  setMonthIdx]  = useState(0)          // 0 = mês atual
  const [addOpen,   setAddOpen]   = useState(false)
  const [selected,  setSelected]  = useState<EmpHours | null>(null)  // para ver detalhe
  const [detailOpen,setDetailOpen]= useState(false)

  // Form lançamento
  const [fEmp,   setFEmp]   = useState('')
  const [fDate,  setFDate]  = useState(new Date().toISOString().slice(0,10))
  const [fType,  setFType]  = useState<'credit'|'debit'|'compensated'>('credit')
  const [fHours, setFHours] = useState('')
  const [fDesc,  setFDesc]  = useState('')
  const [saving, setSaving] = useState(false)
  const [employees, setEmployees] = useState<{id:string;full_name:string}[]>([])

  const ref = monthRef(monthIdx)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user?.company_id) { setLoading(false); return }
    setLoading(true)
    const supabase  = createClient()
    const mStart = ref + '-01'
    const mEnd   = ref + '-31'

    const [empRes, entRes] = await Promise.all([
      supabase.from('employees').select('id, full_name, position, department:departments(name)')
        .eq('company_id', user.company_id).eq('status', 'active').order('full_name'),
      supabase.from('hour_bank_entries').select('*')
        .eq('company_id', user.company_id)
        .gte('date', mStart).lte('date', mEnd)
        .order('date', { ascending: false }),
    ])

    const emps    = (empRes.status === 'fulfilled' ? empRes.value.data : null) ?? []
    const entries = (entRes.status === 'fulfilled' ? entRes.value.data : null) ?? []

    setEmployees(emps.map((e: any) => ({ id: e.id, full_name: e.full_name })))

    const result: EmpHours[] = emps.map((e: any) => {
      const myEntries = (entries as Entry[]).filter(en => en.employee_id === e.id)
      const saldo = myEntries.reduce((s, en) => {
        if (en.type === 'credit')      return s + en.hours
        if (en.type === 'debit')       return s - en.hours
        if (en.type === 'compensated') return s - en.hours
        return s
      }, 0)
      return { id: e.id, full_name: e.full_name, position: e.position, department: e.department, saldo, entries: myEntries }
    })

    setEmpHours(result)
    setLoading(false)
  }, [user, ref])

  useEffect(() => { load() }, [load])

  async function saveLaunch() {
    if (!fEmp || !fHours || !fDate) { toast.error('Preencha todos os campos obrigatórios'); return }
    const hrs = parseFloat(fHours.replace(',', '.'))
    if (isNaN(hrs) || hrs <= 0) { toast.error('Horas inválidas'); return }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('hour_bank_entries').insert({
      company_id:  user!.company_id,
      employee_id: fEmp,
      date:        fDate,
      type:        fType,
      hours:       hrs,
      description: fDesc || (fType === 'credit' ? 'Horas extras' : fType === 'debit' ? 'Débito de horas' : 'Compensação'),
      created_by:  user!.id,
    })
    if (error) {
      if (error.message.includes('does not exist')) {
        toast.error('Execute a migração SQL primeiro (20260628_hour_bank.sql)')
      } else {
        toast.error('Erro ao lançar: ' + error.message)
      }
    } else {
      toast.success('Lançamento registrado!')
      setAddOpen(false); setFHours(''); setFDesc(''); load()
    }
    setSaving(false)
  }

  function exportCSV() {
    const rows = empHours.map(e => [e.full_name, e.position ?? '', (e.department as any)?.name ?? '', fmtHours(e.saldo, true), e.entries.length])
    const csv  = ['Nome,Cargo,Departamento,Saldo,Lançamentos', ...rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(','))].join('\n')
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `banco-horas_${ref}.csv`; a.click()
  }

  const filtered  = empHours.filter(e => !search || e.full_name.toLowerCase().includes(search.toLowerCase()))
  const totalCred = filtered.reduce((s,e) => s + (e.saldo > 0 ? e.saldo : 0), 0)
  const totalDeb  = filtered.reduce((s,e) => s + (e.saldo < 0 ? Math.abs(e.saldo) : 0), 0)
  const withDebt  = filtered.filter(e => e.saldo < -8).length    // mais de 8h negativas

  const TYPE_LABELS = { credit: 'Crédito (extras)', debit: 'Débito', compensated: 'Compensação' }
  const TYPE_COLORS: Record<string, string> = {
    credit:      'bg-green-100 text-green-700',
    debit:       'bg-red-100 text-red-600',
    compensated: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6" /> Banco de Horas — Equipe
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Controle de créditos e débitos de horas por colaborador</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Lançar horas
          </Button>
        </div>
      </div>

      {/* Navegação de mês */}
      <div className="flex items-center gap-3">
        <button onClick={() => setMonthIdx(i => i + 1)} className="p-1.5 border rounded-md hover:bg-gray-50">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium w-36 text-center capitalize">{monthLabel(ref)}</span>
        <button onClick={() => setMonthIdx(i => Math.max(0, i - 1))} className="p-1.5 border rounded-md hover:bg-gray-50" disabled={monthIdx === 0}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total créditos</p>
          <p className="text-xl font-bold text-green-600 mt-1">{fmtHours(totalCred)}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total débitos</p>
          <p className="text-xl font-bold text-red-500 mt-1">-{fmtHours(totalDeb, false)}</p>
        </div>
        <div className={`border rounded-xl p-4 ${withDebt > 0 ? 'bg-red-50 border-red-100' : 'bg-white'}`}>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Com saldo negativo</p>
          <p className={`text-xl font-bold mt-1 ${withDebt > 0 ? 'text-red-600' : 'text-gray-600'}`}>{withDebt}</p>
          {withDebt > 0 && <p className="text-xs text-red-400">colaborador(es) com {'>'} 8h negativas</p>}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Filtrar colaborador..." className="pl-8 h-8 text-sm" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs uppercase text-gray-400">
                <th className="text-left px-4 py-3">Colaborador</th>
                <th className="text-left px-4 py-3">Cargo / Depto</th>
                <th className="text-center px-4 py-3">Lançamentos</th>
                <th className="text-right px-4 py-3">Saldo do mês</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">Nenhum colaborador encontrado</td></tr>
              ) : filtered.map(e => (
                <tr key={e.id} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{e.full_name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {e.position ?? '-'}
                    {(e.department as any)?.name && <span className="ml-1 text-gray-400">· {(e.department as any).name}</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{e.entries.length}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold text-base ${e.saldo > 0 ? 'text-green-600' : e.saldo < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                      {fmtHours(e.saldo)}
                    </span>
                    {e.saldo < -8 && <AlertCircle className="inline h-3.5 w-3.5 text-red-500 ml-1" />}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => { setSelected(e); setDetailOpen(true) }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Ver lançamentos
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal lançar horas */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lançar horas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Colaborador *</Label>
              <select value={fEmp} onChange={e => setFEmp(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="">Selecionar...</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Data *</Label>
                <input type="date" value={fDate} onChange={e => setFDate(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background" />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <select value={fType} onChange={e => setFType(e.target.value as any)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                  <option value="credit">Crédito (extras)</option>
                  <option value="debit">Débito</option>
                  <option value="compensated">Compensação</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Horas (ex: 2, 1.5, 0.5) *</Label>
              <Input placeholder="Ex: 2 ou 1.5" value={fHours} onChange={e => setFHours(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input placeholder="Ex: Horas extras — reunião sábado" value={fDesc} onChange={e => setFDesc(e.target.value)} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={saveLaunch} disabled={saving} className="flex-1">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Lançar
              </Button>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal detalhe de lançamentos */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.full_name} — Lançamentos em {monthLabel(ref)}</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {selected?.entries.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Nenhum lançamento neste mês</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {selected?.entries.map(en => (
                  <div key={en.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{en.description}</p>
                      <p className="text-xs text-gray-400">{new Date(en.date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[en.type]}`}>
                        {TYPE_LABELS[en.type]}
                      </span>
                      <p className={`text-sm font-bold mt-1 ${en.type === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                        {en.type === 'credit' ? '+' : '-'}{fmtHours(en.hours, false)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 pt-3 border-t flex justify-between text-sm">
              <span className="text-gray-500">Saldo do mês</span>
              <span className={`font-bold ${(selected?.saldo ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {fmtHours(selected?.saldo ?? 0)}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
