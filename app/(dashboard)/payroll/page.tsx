'use client'

import { useEffect, useState, useCallback } from 'react'
import { DollarSign, ChevronLeft, ChevronRight, Plus, Lock, Unlock, Users, Printer, Download, PlusCircle, MinusCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency } from '@/lib/utils'
import type { Payroll, PayrollItem, Employee, PayrollStatus } from '@/types/database'

export const dynamic = 'force-dynamic'

const STATUS_MAP: Record<PayrollStatus, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  open:       { label: 'Aberta',      variant: 'outline' },
  processing: { label: 'Processando', variant: 'secondary' },
  closed:     { label: 'Fechada',     variant: 'default' },
}

function calcDeductions(gross: number) {
  const inss = Math.min(gross * 0.14, 908.86)
  const baseIrrf = gross - inss
  let irrf = 0
  if (baseIrrf > 4664.68)      irrf = baseIrrf * 0.275 - 869.36
  else if (baseIrrf > 3751.06) irrf = baseIrrf * 0.225 - 636.13
  else if (baseIrrf > 2826.66) irrf = baseIrrf * 0.15  - 354.80
  else if (baseIrrf > 2259.20) irrf = baseIrrf * 0.075 - 169.44
  const fgts = gross * 0.08
  return { inss: +inss.toFixed(2), irrf: Math.max(0, +irrf.toFixed(2)), fgts: +fgts.toFixed(2) }
}

function monthLabel(ref: string) {
  const [y, m] = ref.split('-')
  return new Date(+y, +m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

type Extra = { descricao: string; valor: number }

function exportPayrollCSV(items: PayrollItem[], employees: Employee[], ref: string) {
  const getEmp = (id: string) => employees.find(e => e.id === id)
  const header = 'Colaborador,CPF,Salário Bruto,INSS,IRRF,FGTS,Outros Descontos,Outras Verbas,Salário Líquido'
  const rows   = items.map(i => {
    const emp   = getEmp(i.employee_id)
    const discs = ((i.other_discounts ?? []) as Extra[]).reduce((s: number, d: Extra) => s + d.valor, 0)
    const adds  = ((i.other_additions  ?? []) as Extra[]).reduce((s: number, a: Extra) => s + a.valor, 0)
    return [
      `"${emp?.full_name ?? ''}"`,
      emp?.cpf ?? '',
      i.gross_salary.toFixed(2).replace('.', ','),
      i.inss.toFixed(2).replace('.', ','),
      i.irrf.toFixed(2).replace('.', ','),
      i.fgts.toFixed(2).replace('.', ','),
      discs.toFixed(2).replace('.', ','),
      adds.toFixed(2).replace('.', ','),
      i.net_salary.toFixed(2).replace('.', ','),
    ].join(',')
  })
  const csv  = [header, ...rows].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `folha_${ref}.csv`; a.click()
  URL.revokeObjectURL(url)
}

export default function PayrollPage() {
  const { user } = useAuth()
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)

  const [payroll,   setPayroll]   = useState<Payroll | null>(null)
  const [items,     setItems]     = useState<PayrollItem[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading,   setLoading]   = useState(true)
  const [detailId,  setDetailId]  = useState<string | null>(null)

  // Extras/descontos dialog
  const [extrasId,      setExtrasId]      = useState<string | null>(null)
  const [extrasForm,    setExtrasForm]    = useState<{ additions: Extra[]; discounts: Extra[] }>({ additions: [], discounts: [] })
  const [newExtra,      setNewExtra]      = useState({ descricao: '', valor: '' })
  const [newDiscount,   setNewDiscount]   = useState({ descricao: '', valor: '' })
  const [savingExtras,  setSavingExtras]  = useState(false)

  const refMonth = `${year}-${String(month).padStart(2, '0')}`

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const supabase = createClient()
    setLoading(true)
    const [pRes, eRes] = await Promise.all([
      supabase.from('payrolls').select('*').eq('company_id', user.company_id).eq('reference_month', refMonth).maybeSingle(),
      supabase.from('employees').select('*').eq('company_id', user.company_id).eq('status', 'active').order('full_name'),
    ])
    setPayroll(pRes.data ?? null)
    setEmployees(eRes.data ?? [])
    if (pRes.data) {
      const { data: it } = await supabase.from('payroll_items').select('*').eq('payroll_id', pRes.data.id)
      setItems(it ?? [])
    } else { setItems([]) }
    setLoading(false)
  }, [user, refMonth])

  useEffect(() => { load() }, [load])

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  const createPayroll = async () => {
    if (!isSupabaseConfigured() || !user) return
    if (employees.length === 0) { toast.error('Sem colaboradores ativos'); return }
    const supabase = createClient()
    const payrollItems = employees.map(emp => {
      const { inss, irrf, fgts } = calcDeductions(emp.salary)
      return { employee_id: emp.id, gross_salary: emp.salary, inss, irrf, fgts, net_salary: +(emp.salary - inss - irrf).toFixed(2), other_discounts: null, other_additions: null }
    })
    const totalGross      = +payrollItems.reduce((s, i) => s + i.gross_salary, 0).toFixed(2)
    const totalDeductions = +payrollItems.reduce((s, i) => s + i.inss + i.irrf, 0).toFixed(2)
    const totalNet        = +payrollItems.reduce((s, i) => s + i.net_salary, 0).toFixed(2)
    const { data: newPayroll, error } = await supabase.from('payrolls').insert({
      company_id: user.company_id, reference_month: refMonth, status: 'open',
      total_gross: totalGross, total_deductions: totalDeductions, total_net: totalNet,
    }).select().single()
    if (error || !newPayroll) { toast.error('Erro ao criar folha'); return }
    await supabase.from('payroll_items').insert(payrollItems.map(i => ({ ...i, payroll_id: newPayroll.id })))
    toast.success('Folha criada!')
    load()
  }

  const closePayroll = async () => {
    if (!payroll || !isSupabaseConfigured()) return
    if (!confirm('Fechar a folha? Ela ficará como "Fechada" e poderá ser reaberta se necessário.')) return
    const supabase = createClient()
    await supabase.from('payrolls').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', payroll.id)
    toast.success('Folha fechada!')
    load()
  }

  const reopenPayroll = async () => {
    if (!payroll || !isSupabaseConfigured()) return
    if (!confirm('Reabrir esta folha para edição?')) return
    const supabase = createClient()
    await supabase.from('payrolls').update({ status: 'open', closed_at: null }).eq('id', payroll.id)
    toast.success('Folha reaberta!')
    load()
  }

  // Abrir dialog de verbas/descontos
  const openExtras = (empId: string) => {
    const item = items.find(i => i.employee_id === empId)
    setExtrasId(empId)
    setExtrasForm({
      additions: (item?.other_additions ?? []) as Extra[],
      discounts: (item?.other_discounts ?? []) as Extra[],
    })
    setNewExtra({ descricao: '', valor: '' })
    setNewDiscount({ descricao: '', valor: '' })
  }

  const saveExtras = async () => {
    if (!extrasId || !isSupabaseConfigured()) return
    const item = items.find(i => i.employee_id === extrasId)
    if (!item) return
    setSavingExtras(true)
    const supabase = createClient()
    const totalAdds  = extrasForm.additions.reduce((s, a) => s + a.valor, 0)
    const totalDiscs = extrasForm.discounts.reduce((s, d) => s + d.valor, 0)
    const newNet     = +(item.gross_salary - item.inss - item.irrf + totalAdds - totalDiscs).toFixed(2)
    const { error } = await supabase.from('payroll_items').update({
      other_additions: extrasForm.additions.length > 0 ? extrasForm.additions : null,
      other_discounts: extrasForm.discounts.length > 0 ? extrasForm.discounts : null,
      net_salary: newNet,
    }).eq('id', item.id)
    if (error) { toast.error('Erro ao salvar'); setSavingExtras(false); return }
    // Recalcular totais da folha
    const updatedItems = items.map(i => i.id === item.id ? { ...i, other_additions: extrasForm.additions, other_discounts: extrasForm.discounts, net_salary: newNet } : i)
    const totalNet = +updatedItems.reduce((s, i) => s + i.net_salary, 0).toFixed(2)
    const totalDed = +updatedItems.reduce((s, i) => s + i.inss + i.irrf + ((i.other_discounts ?? []) as Extra[]).reduce((a: number, d: Extra) => a + d.valor, 0), 0).toFixed(2)
    if (payroll) {
      await supabase.from('payrolls').update({ total_net: totalNet, total_deductions: totalDed }).eq('id', payroll.id)
    }
    setSavingExtras(false)
    setExtrasId(null)
    toast.success('Verbas atualizadas!')
    load()
  }

  const getEmpName = (id: string) => employees.find(e => e.id === id)?.full_name ?? '—'
  const detailItem = items.find(i => i.employee_id === detailId)
  const extrasItem = items.find(i => i.employee_id === extrasId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Folha de Pagamento</h1>
          <p className="text-gray-500 mt-1">Processamento mensal de salários</p>
        </div>
        <div className="flex gap-2">
          {payroll && items.length > 0 && (
            <Button variant="outline" onClick={() => exportPayrollCSV(items, employees, refMonth)}>
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
          )}
          {!payroll && !loading && (
            <Button onClick={createPayroll}><Plus className="h-4 w-4 mr-2" />Gerar folha</Button>
          )}
          {payroll?.status === 'open' && (
            <Button variant="destructive" onClick={closePayroll}>
              <Lock className="h-4 w-4 mr-2" />Fechar folha
            </Button>
          )}
          {payroll?.status === 'closed' && (
            <Button variant="outline" onClick={reopenPayroll}>
              <Unlock className="h-4 w-4 mr-2" />Reabrir folha
            </Button>
          )}
        </div>
      </div>

      {/* Navegação mês */}
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-gray-100"><ChevronLeft className="h-5 w-5" /></button>
        <span className="font-semibold text-gray-800 capitalize w-52 text-center">{monthLabel(refMonth)}</span>
        <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-gray-100"><ChevronRight className="h-5 w-5" /></button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400 bg-white rounded-xl border">Carregando...</div>
      ) : !payroll ? (
        <div className="p-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
          <DollarSign className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 font-medium">Folha não gerada para este mês</p>
          <p className="text-gray-400 text-sm mt-1">Clique em "Gerar folha" para calcular os {employees.length} colaboradores ativos</p>
        </div>
      ) : (
        <>
          {/* Totais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Colaboradores', value: String(items.length),               icon: Users,      color: 'text-blue-600',  bg: 'bg-blue-50' },
              { label: 'Total bruto',   value: formatCurrency(payroll.total_gross),        icon: DollarSign, color: 'text-gray-700', bg: 'bg-gray-50' },
              { label: 'Descontos',     value: formatCurrency(payroll.total_deductions),   icon: Unlock,     color: 'text-red-600',  bg: 'bg-red-50' },
              { label: 'Total líquido', value: formatCurrency(payroll.total_net),          icon: DollarSign, color: 'text-green-600',bg: 'bg-green-50' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className={`${bg} rounded-xl p-4`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <span className="text-xs text-gray-500">{label}</span>
                </div>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Badge variant={STATUS_MAP[payroll.status].variant}>{STATUS_MAP[payroll.status].label}</Badge>
            {payroll.status === 'closed' && payroll.closed_at && (
              <span className="text-xs text-gray-400">Fechada em {new Date(payroll.closed_at).toLocaleDateString('pt-BR')}</span>
            )}
          </div>

          {/* Tabela itens */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Colaborador','Salário bruto','INSS','IRRF','FGTS','Verbas/Descontos','Salário líquido',''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map(item => {
                  const adds  = ((item.other_additions  ?? []) as Extra[]).reduce((s: number, a: Extra) => s + a.valor, 0)
                  const discs = ((item.other_discounts  ?? []) as Extra[]).reduce((s: number, d: Extra) => s + d.valor, 0)
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{getEmpName(item.employee_id)}</td>
                      <td className="px-4 py-3 text-gray-700">{formatCurrency(item.gross_salary)}</td>
                      <td className="px-4 py-3 text-red-600">-{formatCurrency(item.inss)}</td>
                      <td className="px-4 py-3 text-red-600">-{formatCurrency(item.irrf)}</td>
                      <td className="px-4 py-3 text-gray-500">{formatCurrency(item.fgts)}</td>
                      <td className="px-4 py-3 text-xs">
                        {adds > 0 && <span className="text-green-600">+{formatCurrency(adds)} </span>}
                        {discs > 0 && <span className="text-red-500">-{formatCurrency(discs)}</span>}
                        {adds === 0 && discs === 0 && <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 font-semibold text-green-700">{formatCurrency(item.net_salary)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => setDetailId(item.employee_id)}
                            className="text-xs px-2 py-1 rounded hover:bg-gray-100 text-gray-500">
                            Holerite
                          </button>
                          {payroll.status === 'open' && (
                            <button onClick={() => openExtras(item.employee_id)}
                              className="text-xs px-2 py-1 rounded hover:bg-blue-50 text-blue-500">
                              Verbas
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Dialog holerite */}
      <Dialog open={!!detailId} onOpenChange={(o) => { if (!o) setDetailId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Holerite — {detailId ? getEmpName(detailId) : ''}</DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-3 text-sm pt-2">
              <p className="text-xs text-gray-400 capitalize">{monthLabel(refMonth)}</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Salário bruto</span>
                  <span className="font-medium">{formatCurrency(detailItem.gross_salary)}</span>
                </div>
                {((detailItem.other_additions ?? []) as Extra[]).map((a, i) => (
                  <div key={i} className="flex justify-between text-green-600">
                    <span>{a.descricao}</span><span>+{formatCurrency(a.valor)}</span>
                  </div>
                ))}
                <Separator />
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Descontos</p>
                <div className="flex justify-between text-red-600">
                  <span>INSS ({((detailItem.inss / detailItem.gross_salary) * 100).toFixed(1)}%)</span>
                  <span>-{formatCurrency(detailItem.inss)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>IRRF</span><span>-{formatCurrency(detailItem.irrf)}</span>
                </div>
                {((detailItem.other_discounts ?? []) as Extra[]).map((d, i) => (
                  <div key={i} className="flex justify-between text-red-500">
                    <span>{d.descricao}</span><span>-{formatCurrency(d.valor)}</span>
                  </div>
                ))}
                <Separator />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Encargos patronais</p>
                <div className="flex justify-between text-gray-500">
                  <span>FGTS (8%)</span><span>{formatCurrency(detailItem.fgts)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-bold text-green-700">
                  <span>Salário líquido</span><span>{formatCurrency(detailItem.net_salary)}</span>
                </div>
              </div>
              <div className="pt-2">
                <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => {
                  const empName = detailId ? getEmpName(detailId) : ''
                  const adds  = ((detailItem.other_additions ?? []) as Extra[])
                  const discs = ((detailItem.other_discounts ?? []) as Extra[])
                  const w = window.open('', '_blank', 'width=480,height=700')
                  if (!w) return
                  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Holerite</title>
                    <style>body{font-family:sans-serif;padding:32px;max-width:400px;margin:auto}
                    h2{font-size:18px;margin-bottom:4px}p.sub{font-size:12px;color:#888;margin:0 0 16px}
                    .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px}
                    .red{color:#dc2626}.green{color:#16a34a}.bold{font-weight:700;font-size:15px}
                    .section{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-top:12px;margin-bottom:4px;color:#888}
                    </style></head><body>
                    <h2>Holerite — ${empName}</h2><p class="sub">${monthLabel(refMonth)}</p>
                    <div class="row"><span>Salário bruto</span><span>${formatCurrency(detailItem.gross_salary)}</span></div>
                    ${adds.map(a => `<div class="row green"><span>${a.descricao}</span><span>+${formatCurrency(a.valor)}</span></div>`).join('')}
                    <div class="section">Descontos</div>
                    <div class="row red"><span>INSS (${((detailItem.inss / detailItem.gross_salary) * 100).toFixed(1)}%)</span><span>-${formatCurrency(detailItem.inss)}</span></div>
                    <div class="row red"><span>IRRF</span><span>-${formatCurrency(detailItem.irrf)}</span></div>
                    ${discs.map(d => `<div class="row red"><span>${d.descricao}</span><span>-${formatCurrency(d.valor)}</span></div>`).join('')}
                    <div class="section">Encargos patronais</div>
                    <div class="row" style="color:#888"><span>FGTS (8%)</span><span>${formatCurrency(detailItem.fgts)}</span></div>
                    <div class="row" style="margin-top:8px"><span class="bold green">Salário líquido</span><span class="bold green">${formatCurrency(detailItem.net_salary)}</span></div>
                    </body></html>`)
                  w.document.close(); w.focus(); w.print()
                }}>
                  <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog verbas extras */}
      <Dialog open={!!extrasId} onOpenChange={(o) => { if (!o) setExtrasId(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Verbas e Descontos — {extrasId ? getEmpName(extrasId) : ''}</DialogTitle>
          </DialogHeader>
          {extrasItem && (
            <div className="space-y-5 pt-2">
              <p className="text-xs text-gray-500">
                Salário base: <strong>{formatCurrency(extrasItem.gross_salary)}</strong> — INSS: <strong>-{formatCurrency(extrasItem.inss)}</strong> — IRRF: <strong>-{formatCurrency(extrasItem.irrf)}</strong>
              </p>

              {/* Verbas (adições) */}
              <div>
                <p className="text-sm font-semibold text-green-700 flex items-center gap-1 mb-2">
                  <PlusCircle className="h-4 w-4" /> Verbas extras
                </p>
                <div className="space-y-1.5">
                  {extrasForm.additions.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm bg-green-50 rounded-lg px-3 py-2">
                      <span className="flex-1">{a.descricao}</span>
                      <span className="text-green-700 font-medium">+{formatCurrency(a.valor)}</span>
                      <button onClick={() => setExtrasForm(f => ({ ...f, additions: f.additions.filter((_, j) => j !== i) }))}
                        className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input placeholder="Descrição (ex: Hora extra)" value={newExtra.descricao}
                      onChange={e => setNewExtra(f => ({ ...f, descricao: e.target.value }))} className="flex-1" />
                    <Input placeholder="Valor" type="number" value={newExtra.valor}
                      onChange={e => setNewExtra(f => ({ ...f, valor: e.target.value }))} className="w-28" />
                    <Button type="button" size="sm" variant="outline" onClick={() => {
                      if (!newExtra.descricao || !newExtra.valor) return
                      setExtrasForm(f => ({ ...f, additions: [...f.additions, { descricao: newExtra.descricao, valor: +newExtra.valor }] }))
                      setNewExtra({ descricao: '', valor: '' })
                    }}>Adicionar</Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Descontos extras */}
              <div>
                <p className="text-sm font-semibold text-red-600 flex items-center gap-1 mb-2">
                  <MinusCircle className="h-4 w-4" /> Descontos extras
                </p>
                <div className="space-y-1.5">
                  {extrasForm.discounts.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm bg-red-50 rounded-lg px-3 py-2">
                      <span className="flex-1">{d.descricao}</span>
                      <span className="text-red-600 font-medium">-{formatCurrency(d.valor)}</span>
                      <button onClick={() => setExtrasForm(f => ({ ...f, discounts: f.discounts.filter((_, j) => j !== i) }))}
                        className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input placeholder="Descrição (ex: Vale adiantamento)" value={newDiscount.descricao}
                      onChange={e => setNewDiscount(f => ({ ...f, descricao: e.target.value }))} className="flex-1" />
                    <Input placeholder="Valor" type="number" value={newDiscount.valor}
                      onChange={e => setNewDiscount(f => ({ ...f, valor: e.target.value }))} className="w-28" />
                    <Button type="button" size="sm" variant="outline" onClick={() => {
                      if (!newDiscount.descricao || !newDiscount.valor) return
                      setExtrasForm(f => ({ ...f, discounts: [...f.discounts, { descricao: newDiscount.descricao, valor: +newDiscount.valor }] }))
                      setNewDiscount({ descricao: '', valor: '' })
                    }}>Adicionar</Button>
                  </div>
                </div>
              </div>

              {/* Preview salário líquido */}
              <div className="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
                <span className="text-sm text-gray-600">Salário líquido calculado</span>
                <span className="text-lg font-bold text-green-700">
                  {formatCurrency(
                    extrasItem.gross_salary - extrasItem.inss - extrasItem.irrf
                    + extrasForm.additions.reduce((s, a) => s + a.valor, 0)
                    - extrasForm.discounts.reduce((s, d) => s + d.valor, 0)
                  )}
                </span>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setExtrasId(null)}>Cancelar</Button>
                <Button onClick={saveExtras} disabled={savingExtras}>
                  {savingExtras && <span className="mr-2 animate-spin">⟳</span>}
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
