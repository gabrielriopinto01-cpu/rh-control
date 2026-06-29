'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Stethoscope, Plus, Pencil, Trash2, Loader2, Search,
  AlertTriangle, CheckCircle2, Clock, Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export const dynamic = 'force-dynamic'

const TYPES: Record<string, string> = {
  admissional:      'Admissional',
  periodico:        'Periódico',
  retorno_trabalho: 'Retorno ao Trabalho',
  mudanca_funcao:   'Mudança de Função',
  demissional:      'Demissional',
}

const RESULTS: Record<string, { label: string; color: string }> = {
  apto:           { label: 'Apto',              color: 'bg-green-100 text-green-700' },
  apto_restricoes:{ label: 'Apto c/ restrições',color: 'bg-amber-100 text-amber-700' },
  inapto:         { label: 'Inapto',            color: 'bg-red-100 text-red-700' },
}

type AsoRecord = {
  id: string; employee_id: string; type: string; exam_date: string
  next_exam_date?: string; result: string; doctor_name?: string
  crm?: string; clinic?: string; restrictions?: string; notes?: string
  employee?: { full_name: string; department?: { name: string } }
}
type Employee = { id: string; full_name: string }

type Form = {
  employee_id: string; type: string; exam_date: string; next_exam_date: string
  result: string; doctor_name: string; crm: string; clinic: string
  restrictions: string; notes: string
}

const blank = (): Form => ({
  employee_id: '', type: 'periodico',
  exam_date: new Date().toISOString().slice(0, 10),
  next_exam_date: '', result: 'apto',
  doctor_name: '', crm: '', clinic: '', restrictions: '', notes: '',
})

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

function daysUntil(d?: string | null): number | null {
  if (!d) return null
  return Math.round((new Date(d + 'T00:00:00').getTime() - new Date().setHours(0,0,0,0)) / 86400000)
}

function ExpiryBadge({ date }: { date?: string | null }) {
  const days = daysUntil(date)
  if (days === null) return <span className="text-muted-foreground text-xs">Sem prazo</span>
  if (days < 0)   return <Badge className="bg-red-100 text-red-700">Vencido {Math.abs(days)}d</Badge>
  if (days <= 30) return <Badge className="bg-amber-100 text-amber-700">Vence em {days}d</Badge>
  return <span className="text-sm text-muted-foreground">{fmtDate(date)}</span>
}

export default function AsoPage() {
  const { user }  = useAuth()
  const [records,   setRecords]   = useState<AsoRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [filter,    setFilter]    = useState<'all' | 'expired' | 'expiring' | 'ok'>('all')
  const [dialog,    setDialog]    = useState(false)
  const [editing,   setEditing]   = useState<AsoRecord | null>(null)
  const [form,      setForm]      = useState<Form>(blank())
  const [saving,    setSaving]    = useState(false)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const sb = createClient()
    const [rRes, eRes] = await Promise.allSettled([
      sb.from('aso_records')
        .select('*, employee:employees(full_name, department:departments(name))')
        .eq('company_id', user.company_id)
        .order('exam_date', { ascending: false }),
      sb.from('employees').select('id, full_name').eq('company_id', user.company_id).eq('status', 'active').order('full_name'),
    ])
    if (rRes.status === 'fulfilled') setRecords((rRes.value.data ?? []) as AsoRecord[])
    if (eRes.status === 'fulfilled') setEmployees((eRes.value.data ?? []) as Employee[])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.employee_id) { toast.error('Selecione o colaborador'); return }
    setSaving(true)
    const sb = createClient()
    const payload = {
      company_id: user!.company_id,
      employee_id: form.employee_id,
      type: form.type,
      exam_date: form.exam_date,
      next_exam_date: form.next_exam_date || null,
      result: form.result,
      doctor_name: form.doctor_name || null,
      crm: form.crm || null,
      clinic: form.clinic || null,
      restrictions: form.restrictions || null,
      notes: form.notes || null,
      created_by: user!.id,
    }
    const { error } = editing
      ? await sb.from('aso_records').update(payload).eq('id', editing.id)
      : await sb.from('aso_records').insert(payload)
    setSaving(false)
    if (error) { toast.error('Erro ao salvar'); return }
    toast.success(editing ? 'ASO atualizado' : 'ASO registrado')
    setDialog(false); setEditing(null); load()
  }

  const remove = async (id: string) => {
    if (!confirm('Excluir este ASO?')) return
    const { error } = await createClient().from('aso_records').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Excluído'); load()
  }

  const exportCsv = () => {
    const rows = [['Colaborador','Departamento','Tipo','Data Exame','Próximo Exame','Resultado','Médico','CRM','Clínica']]
    records.forEach(r => rows.push([
      (r.employee as any)?.full_name ?? '',
      (r.employee as any)?.department?.name ?? '',
      TYPES[r.type] ?? r.type,
      fmtDate(r.exam_date),
      fmtDate(r.next_exam_date),
      RESULTS[r.result]?.label ?? r.result,
      r.doctor_name ?? '',
      r.crm ?? '',
      r.clinic ?? '',
    ]))
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `aso_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  }

  // Pega apenas o ASO mais recente por colaborador para análise de status
  const latestByEmployee = Object.values(
    records.reduce<Record<string, AsoRecord>>((acc, r) => {
      if (!acc[r.employee_id] || r.exam_date > acc[r.employee_id]!.exam_date) acc[r.employee_id] = r
      return acc
    }, {})
  )

  const counts = {
    expired:  latestByEmployee.filter(r => { const d = daysUntil(r.next_exam_date); return d !== null && d < 0 }).length,
    expiring: latestByEmployee.filter(r => { const d = daysUntil(r.next_exam_date); return d !== null && d >= 0 && d <= 30 }).length,
    ok:       latestByEmployee.filter(r => { const d = daysUntil(r.next_exam_date); return d !== null && d > 30 }).length,
    inapto:   latestByEmployee.filter(r => r.result === 'inapto').length,
  }

  const filtered = records.filter(r => {
    const nameMatch = !search || (r.employee as any)?.full_name?.toLowerCase().includes(search.toLowerCase())
    if (!nameMatch) return false
    if (filter === 'all') return true
    const d = daysUntil(r.next_exam_date)
    if (filter === 'expired')  return d !== null && d < 0
    if (filter === 'expiring') return d !== null && d >= 0 && d <= 30
    if (filter === 'ok')       return d !== null && d > 30
    return true
  })

  if (loading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Stethoscope className="h-6 w-6" /> Exames Médicos — ASO
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Atestado de Saúde Ocupacional — NR-7 / CLT Art. 168
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" /> CSV</Button>
          <Button onClick={() => { setEditing(null); setForm(blank()); setDialog(true) }}>
            <Plus className="h-4 w-4 mr-2" /> Registrar ASO
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { key: 'expired',  label: 'Vencidos',       value: counts.expired,  Icon: AlertTriangle, color: 'text-red-600' },
          { key: 'expiring', label: 'Vencem em 30d',  value: counts.expiring, Icon: Clock,         color: 'text-amber-600' },
          { key: 'ok',       label: 'Em dia',         value: counts.ok,       Icon: CheckCircle2,  color: 'text-green-600' },
          { key: 'all',      label: 'Inaptos',        value: counts.inapto,   Icon: AlertTriangle, color: 'text-orange-500' },
        ].map(({ key, label, value, Icon, color }) => (
          <button key={key} onClick={() => setFilter(key as any)}
            className={`bg-card border rounded-xl p-4 text-left transition-colors ${filter === key ? 'ring-2 ring-indigo-500 border-indigo-500' : 'hover:border-gray-300'}`}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold mt-1 flex items-center gap-1.5 ${color}`}>
              {value} <Icon className="h-5 w-5" />
            </p>
          </button>
        ))}
      </div>

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar colaborador..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Tabela */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium">Colaborador</th>
              <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Tipo</th>
              <th className="text-left px-4 py-3 font-medium">Data exame</th>
              <th className="text-left px-4 py-3 font-medium">Próximo</th>
              <th className="text-left px-4 py-3 font-medium">Resultado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(r => {
              const res = RESULTS[r.result]!
              return (
                <tr key={r.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <p className="font-medium">{(r.employee as any)?.full_name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{(r.employee as any)?.department?.name ?? ''}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{TYPES[r.type] ?? r.type}</td>
                  <td className="px-4 py-3">{fmtDate(r.exam_date)}</td>
                  <td className="px-4 py-3"><ExpiryBadge date={r.next_exam_date} /></td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${res.color}`}>{res.label}</span>
                    {r.restrictions && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[160px]">{r.restrictions}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => {
                        setEditing(r)
                        setForm({
                          employee_id: r.employee_id, type: r.type,
                          exam_date: r.exam_date, next_exam_date: r.next_exam_date ?? '',
                          result: r.result, doctor_name: r.doctor_name ?? '',
                          crm: r.crm ?? '', clinic: r.clinic ?? '',
                          restrictions: r.restrictions ?? '', notes: r.notes ?? '',
                        })
                        setDialog(true)
                      }} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => remove(r.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground text-sm">
                Nenhum registro encontrado
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
        <p className="font-medium mb-1">NR-7 — Prazos de periodicidade</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
          <span>Até 18 anos ou ≥ 45 anos: anual</span>
          <span>De 18 a 45 anos: a cada 2 anos</span>
          <span>Trabalho em risco: conforme PCMSO</span>
          <span>Retorno após 30d afastamento: obrigatório</span>
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={dialog} onOpenChange={v => { setDialog(v); if (!v) setEditing(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar ASO' : 'Registrar ASO'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Colaborador *</Label>
                <Select value={form.employee_id} onValueChange={v => setForm(f => ({ ...f, employee_id: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v ?? 'periodico' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Resultado</Label>
                <Select value={form.result} onValueChange={v => setForm(f => ({ ...f, result: v ?? 'apto' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(RESULTS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Data do exame *</Label>
                <Input type="date" value={form.exam_date} onChange={e => setForm(f => ({ ...f, exam_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Próximo exame</Label>
                <Input type="date" value={form.next_exam_date} onChange={e => setForm(f => ({ ...f, next_exam_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Médico responsável</Label>
                <Input placeholder="Nome do médico" value={form.doctor_name} onChange={e => setForm(f => ({ ...f, doctor_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>CRM</Label>
                <Input placeholder="Ex: CRM/SP 123456" value={form.crm} onChange={e => setForm(f => ({ ...f, crm: e.target.value }))} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Clínica / Laboratório</Label>
                <Input placeholder="Nome da clínica" value={form.clinic} onChange={e => setForm(f => ({ ...f, clinic: e.target.value }))} />
              </div>
            </div>
            {form.result === 'apto_restricoes' && (
              <div className="space-y-1.5">
                <Label>Restrições</Label>
                <Textarea rows={2} placeholder="Descreva as restrições..." value={form.restrictions} onChange={e => setForm(f => ({ ...f, restrictions: e.target.value }))} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editing ? 'Salvar' : 'Registrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
