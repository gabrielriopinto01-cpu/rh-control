'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  TrendingUp, Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  CheckCircle2, Clock, Loader2, Download, Users, DollarSign,
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

// Tabela IR exclusiva PLR 2024 (Lei 10.101/2000 + Instrução Normativa)
function calcIR(gross: number): number {
  if (gross <= 6677.55) return 0
  if (gross <= 9922.28) return gross * 0.075 - 500.82
  if (gross <= 13167.00) return gross * 0.15 - 1244.99
  if (gross <= 16380.38) return gross * 0.225 - 2232.51
  return gross * 0.275 - 3051.10
}

const STATUS_CONFIG = {
  draft:    { label: 'Rascunho', variant: 'secondary' as const },
  approved: { label: 'Aprovado', variant: 'default' as const },
  paid:     { label: 'Pago',     variant: 'outline' as const },
}

const brl = (n?: number | null) =>
  n != null ? `R$ ${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'

type Program = {
  id: string; name: string; reference: string; total_pool?: number
  status: 'draft' | 'approved' | 'paid'; payment_date?: string; notes?: string
  items?: PlrItem[]
}
type PlrItem = {
  id: string; program_id: string; employee_id: string; base_salary: number
  months_worked: number; factor: number; gross_amount: number
  ir_withheld: number; net_amount: number; paid: boolean
  employee?: { full_name: string; department?: { name: string } }
}
type Employee = { id: string; full_name: string; salary?: number }

type ProgForm = { name: string; reference: string; total_pool: string; payment_date: string; notes: string; status: string }
const blankProg = (): ProgForm => ({
  name: '', reference: `${new Date().getFullYear()}`, total_pool: '', payment_date: '', notes: '', status: 'draft',
})

export default function PlrPage() {
  const { user } = useAuth()
  const [programs,  setPrograms]  = useState<Program[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading,   setLoading]   = useState(true)
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const [progDialog, setProgDialog] = useState(false)
  const [editingProg, setEditingProg] = useState<Program | null>(null)
  const [calcDialog,  setCalcDialog]  = useState<Program | null>(null)
  const [progForm, setProgForm] = useState<ProgForm>(blankProg())
  const [saving,   setSaving]   = useState(false)

  // Cálculo automático
  const [calcPool,   setCalcPool]   = useState('')
  const [calcMonths, setCalcMonths] = useState('12')
  const [calcRows,   setCalcRows]   = useState<Array<{
    employee_id: string; full_name: string; salary: number; months: number; factor: string; gross: number; ir: number; net: number
  }>>([])

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const sb = createClient()
    const [pRes, eRes] = await Promise.allSettled([
      sb.from('plr_programs')
        .select('*, items:plr_items(*, employee:employees(full_name, department:departments(name)))')
        .eq('company_id', user.company_id)
        .order('created_at', { ascending: false }),
      sb.from('employees').select('id, full_name, salary').eq('company_id', user.company_id).eq('status', 'active').order('full_name'),
    ])
    if (pRes.status === 'fulfilled') setPrograms((pRes.value.data ?? []) as Program[])
    if (eRes.status === 'fulfilled') setEmployees((eRes.value.data ?? []) as Employee[])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // Recalcula tabela ao abrir dialog de cálculo
  useEffect(() => {
    if (!calcDialog) return
    const pool = parseFloat(calcPool) || 0
    if (pool === 0 || employees.length === 0) { setCalcRows([]); return }
    // Prop salarial: cada colaborador recebe proporcional ao salário × meses × fator
    const rows = employees.filter(e => e.salary).map(e => ({
      employee_id: e.id,
      full_name: e.full_name,
      salary: e.salary!,
      months: Number(calcMonths),
      factor: '1.0',
      gross: 0, ir: 0, net: 0,
    }))
    const totalPts = rows.reduce((s, r) => s + r.salary * r.months * parseFloat(r.factor || '1'), 0)
    const filled = rows.map(r => {
      const pts   = r.salary * r.months * parseFloat(r.factor || '1')
      const gross = totalPts > 0 ? Math.round((pts / totalPts) * pool * 100) / 100 : 0
      const ir    = Math.round(calcIR(gross) * 100) / 100
      return { ...r, gross, ir, net: Math.round((gross - ir) * 100) / 100 }
    })
    setCalcRows(filled)
  }, [calcPool, calcMonths, calcDialog, employees])

  const updateFactor = (idx: number, val: string) => {
    const updated = calcRows.map((r, i) => {
      if (i !== idx) return r
      const factor = parseFloat(val) || 1
      const pool   = parseFloat(calcPool) || 0
      const totalPts = calcRows.reduce((s, rr, ii) => s + rr.salary * rr.months * (ii === idx ? factor : parseFloat(rr.factor || '1')), 0)
      const pts    = r.salary * r.months * factor
      const gross  = totalPts > 0 ? Math.round((pts / totalPts) * pool * 100) / 100 : 0
      const ir     = Math.round(calcIR(gross) * 100) / 100
      return { ...r, factor: val, gross, ir, net: Math.round((gross - ir) * 100) / 100 }
    })
    setCalcRows(updated)
  }

  const saveProg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!progForm.name.trim() || !progForm.reference.trim()) { toast.error('Nome e referência obrigatórios'); return }
    setSaving(true)
    const sb = createClient()
    const payload = {
      company_id: user!.company_id,
      name: progForm.name.trim(),
      reference: progForm.reference.trim(),
      total_pool: progForm.total_pool ? parseFloat(progForm.total_pool) : null,
      payment_date: progForm.payment_date || null,
      notes: progForm.notes || null,
      status: progForm.status,
      created_by: user!.id,
    }
    const { error } = editingProg
      ? await sb.from('plr_programs').update(payload).eq('id', editingProg.id)
      : await sb.from('plr_programs').insert(payload)
    setSaving(false)
    if (error) { toast.error('Erro ao salvar programa'); return }
    toast.success(editingProg ? 'Programa atualizado' : 'Programa criado')
    setProgDialog(false); setEditingProg(null); load()
  }

  const saveCalc = async () => {
    if (!calcDialog || calcRows.length === 0) return
    setSaving(true)
    const sb = createClient()
    // Remove itens anteriores e recria
    await sb.from('plr_items').delete().eq('program_id', calcDialog.id)
    const { error } = await sb.from('plr_items').insert(calcRows.map(r => ({
      program_id: calcDialog.id,
      employee_id: r.employee_id,
      base_salary: r.salary,
      months_worked: r.months,
      factor: parseFloat(r.factor) || 1,
      gross_amount: r.gross,
      ir_withheld: r.ir,
      net_amount: r.net,
    })))
    // Atualiza pool no programa
    const total = calcRows.reduce((s, r) => s + r.gross, 0)
    await sb.from('plr_programs').update({ total_pool: total }).eq('id', calcDialog.id)
    setSaving(false)
    if (error) { toast.error('Erro ao salvar cálculo'); return }
    toast.success('Cálculo salvo!')
    setCalcDialog(null); load()
  }

  const exportCsv = (prog: Program) => {
    const items = prog.items ?? []
    const rows = [['Colaborador','Departamento','Salário base','Meses','Fator','Bruto PLR','IR','Líquido PLR']]
    items.forEach(i => rows.push([
      (i.employee as any)?.full_name ?? '',
      (i.employee as any)?.department?.name ?? '',
      String(i.base_salary),
      String(i.months_worked),
      String(i.factor),
      String(i.gross_amount),
      String(i.ir_withheld),
      String(i.net_amount),
    ]))
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `plr_${prog.reference}.csv`; a.click()
  }

  const deleteProg = async (id: string) => {
    if (!confirm('Excluir este programa de PLR?')) return
    const { error } = await createClient().from('plr_programs').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Programa excluído'); load()
  }

  if (loading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6" /> PLR — Participação nos Lucros
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestão de PLR com cálculo proporcional e retenção de IR — Lei 10.101/2000
          </p>
        </div>
        <Button onClick={() => { setEditingProg(null); setProgForm(blankProg()); setProgDialog(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Novo programa
        </Button>
      </div>

      {/* KPIs */}
      {programs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Programas', value: programs.length, Icon: TrendingUp },
            { label: 'Aprovados',  value: programs.filter(p => p.status === 'approved').length, Icon: CheckCircle2 },
            { label: 'Total pago', value: brl(programs.filter(p => p.status === 'paid').reduce((s, p) => s + (p.total_pool ?? 0), 0)), Icon: DollarSign },
          ].map(({ label, value, Icon }) => (
            <div key={label} className="bg-card border rounded-xl p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-xl font-bold mt-1 flex items-center gap-1.5">
                {value} <Icon className="h-4 w-4 text-muted-foreground" />
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Lista de programas */}
      {programs.length === 0 ? (
        <div className="border border-dashed rounded-xl p-12 text-center text-muted-foreground">
          <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="font-medium">Nenhum programa de PLR</p>
          <p className="text-sm mt-1">Clique em "Novo programa" para começar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {programs.map(prog => {
            const sc = STATUS_CONFIG[prog.status]
            const isOpen = expanded === prog.id
            const items  = prog.items ?? []
            const totalGross = items.reduce((s, i) => s + i.gross_amount, 0)
            const totalNet   = items.reduce((s, i) => s + i.net_amount, 0)
            return (
              <div key={prog.id} className="bg-card border rounded-xl overflow-hidden">
                <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors text-left"
                  onClick={() => setExpanded(isOpen ? null : prog.id)}>
                  <div className="flex items-center gap-4 min-w-0">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <div>
                      <p className="font-semibold">{prog.name}</p>
                      <p className="text-sm text-muted-foreground">Ref. {prog.reference}{prog.payment_date ? ` · Pagamento: ${new Date(prog.payment_date + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {items.length > 0 && (
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium">{brl(totalGross)} bruto</p>
                        <p className="text-xs text-muted-foreground">{brl(totalNet)} líquido · {items.length} colab.</p>
                      </div>
                    )}
                    <Badge variant={sc.variant}>{sc.label}</Badge>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t">
                    <div className="flex gap-2 px-5 py-3 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => {
                        setCalcPool(prog.total_pool ? String(prog.total_pool) : '')
                        setCalcDialog(prog)
                      }}>
                        <Users className="h-3.5 w-3.5 mr-1.5" /> Calcular / Distribuir
                      </Button>
                      {items.length > 0 && (
                        <Button size="sm" variant="outline" onClick={() => exportCsv(prog)}>
                          <Download className="h-3.5 w-3.5 mr-1.5" /> Exportar CSV
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => {
                        setEditingProg(prog)
                        setProgForm({
                          name: prog.name, reference: prog.reference,
                          total_pool: prog.total_pool ? String(prog.total_pool) : '',
                          payment_date: prog.payment_date ?? '', notes: prog.notes ?? '',
                          status: prog.status,
                        })
                        setProgDialog(true)
                      }}>
                        <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => deleteProg(prog.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir
                      </Button>
                    </div>

                    {items.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-t">
                          <thead>
                            <tr className="bg-muted/30">
                              <th className="text-left px-4 py-2 font-medium">Colaborador</th>
                              <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Depto</th>
                              <th className="text-right px-4 py-2 font-medium">Bruto</th>
                              <th className="text-right px-4 py-2 font-medium hidden md:table-cell">IR</th>
                              <th className="text-right px-4 py-2 font-medium">Líquido</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {items.map(i => (
                              <tr key={i.id} className="hover:bg-muted/10">
                                <td className="px-4 py-2">{(i.employee as any)?.full_name ?? '—'}</td>
                                <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">{(i.employee as any)?.department?.name ?? '—'}</td>
                                <td className="px-4 py-2 text-right">{brl(i.gross_amount)}</td>
                                <td className="px-4 py-2 text-right text-red-600 hidden md:table-cell">-{brl(i.ir_withheld)}</td>
                                <td className="px-4 py-2 text-right font-medium text-green-700">{brl(i.net_amount)}</td>
                              </tr>
                            ))}
                            <tr className="bg-muted/20 font-semibold">
                              <td className="px-4 py-2" colSpan={2}>Total</td>
                              <td className="px-4 py-2 text-right">{brl(totalGross)}</td>
                              <td className="px-4 py-2 text-right text-red-600 hidden md:table-cell">-{brl(items.reduce((s, i) => s + i.ir_withheld, 0))}</td>
                              <td className="px-4 py-2 text-right text-green-700">{brl(totalNet)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Dialog: Programa */}
      <Dialog open={progDialog} onOpenChange={v => { setProgDialog(v); if (!v) setEditingProg(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingProg ? 'Editar programa' : 'Novo programa PLR'}</DialogTitle></DialogHeader>
          <form onSubmit={saveProg} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="Ex: PLR 2026 — 1º Semestre" value={progForm.name}
                onChange={e => setProgForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Referência *</Label>
                <Input placeholder="Ex: 2026-S1" value={progForm.reference}
                  onChange={e => setProgForm(f => ({ ...f, reference: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={progForm.status} onValueChange={v => setProgForm(f => ({ ...f, status: v ?? 'draft' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Pool total (R$)</Label>
                <Input type="number" placeholder="Ex: 50000" value={progForm.total_pool}
                  onChange={e => setProgForm(f => ({ ...f, total_pool: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Data de pagamento</Label>
                <Input type="date" value={progForm.payment_date}
                  onChange={e => setProgForm(f => ({ ...f, payment_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea rows={2} value={progForm.notes}
                onChange={e => setProgForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setProgDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingProg ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Cálculo */}
      <Dialog open={!!calcDialog} onOpenChange={v => { if (!v) setCalcDialog(null) }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Calcular PLR — {calcDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Pool total a distribuir (R$)</Label>
                <Input type="number" placeholder="Ex: 50000" value={calcPool}
                  onChange={e => setCalcPool(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Meses trabalhados (padrão)</Label>
                <Input type="number" min="1" max="12" value={calcMonths}
                  onChange={e => setCalcMonths(e.target.value)} />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Distribuição proporcional ao salário × meses × fator individual. IR calculado pela tabela exclusiva PLR (Lei 10.101/2000).
            </p>

            {calcRows.length > 0 && (
              <div className="overflow-auto max-h-80 border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Colaborador</th>
                      <th className="text-right px-3 py-2 font-medium">Salário</th>
                      <th className="text-right px-3 py-2 font-medium w-20">Fator</th>
                      <th className="text-right px-3 py-2 font-medium">Bruto</th>
                      <th className="text-right px-3 py-2 font-medium">IR</th>
                      <th className="text-right px-3 py-2 font-medium">Líquido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {calcRows.map((r, idx) => (
                      <tr key={r.employee_id} className="hover:bg-muted/10">
                        <td className="px-3 py-2">{r.full_name}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{brl(r.salary)}</td>
                        <td className="px-3 py-2">
                          <Input type="number" min="0" step="0.1" className="h-7 text-xs text-right w-16"
                            value={r.factor}
                            onChange={e => updateFactor(idx, e.target.value)} />
                        </td>
                        <td className="px-3 py-2 text-right">{brl(r.gross)}</td>
                        <td className="px-3 py-2 text-right text-red-600">-{brl(r.ir)}</td>
                        <td className="px-3 py-2 text-right font-medium text-green-700">{brl(r.net)}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/30 font-semibold text-sm">
                      <td className="px-3 py-2" colSpan={3}>Total</td>
                      <td className="px-3 py-2 text-right">{brl(calcRows.reduce((s, r) => s + r.gross, 0))}</td>
                      <td className="px-3 py-2 text-right text-red-600">-{brl(calcRows.reduce((s, r) => s + r.ir, 0))}</td>
                      <td className="px-3 py-2 text-right text-green-700">{brl(calcRows.reduce((s, r) => s + r.net, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setCalcDialog(null)}>Cancelar</Button>
              <Button disabled={saving || calcRows.length === 0} onClick={saveCalc}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar cálculo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
