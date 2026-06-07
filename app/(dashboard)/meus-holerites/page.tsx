'use client'

import { useEffect, useState, useCallback } from 'react'
import { DollarSign, ChevronLeft, ChevronRight, Printer, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useMyEmployee } from '@/hooks/use-my-employee'
import { formatCurrency } from '@/lib/utils'
import type { Payroll, PayrollItem, PayrollStatus } from '@/types/database'

export const dynamic = 'force-dynamic'

type Extra = { descricao: string; valor: number }

const STATUS_LABELS: Record<PayrollStatus, { label: string; color: string }> = {
  open:       { label: 'Aberta',      color: 'bg-yellow-100 text-yellow-700' },
  processing: { label: 'Processando', color: 'bg-blue-100 text-blue-700' },
  closed:     { label: 'Fechada',     color: 'bg-green-100 text-green-700' },
}

function monthLabel(ref: string) {
  const [y, m] = ref.split('-')
  return new Date(+y, +m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export default function MeusHoleriteesPage() {
  const { user }                          = useAuth()
  const { employee, loading: empLoading } = useMyEmployee()

  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [payroll, setPayroll] = useState<Payroll | null>(null)
  const [item,    setItem]    = useState<PayrollItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<Array<{ payroll: Payroll; item: PayrollItem }>>([])
  const [detailPayroll, setDetailPayroll] = useState<Payroll | null>(null)
  const [detailItem,    setDetailItem]    = useState<PayrollItem | null>(null)

  const refMonth = `${year}-${String(month).padStart(2, '0')}`

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user || !employee) { setLoading(false); return }
    const supabase = createClient()
    setLoading(true)

    // Mês atual
    const { data: payrollData } = await supabase
      .from('payrolls')
      .select('*')
      .eq('company_id', user.company_id)
      .eq('reference_month', refMonth)
      .maybeSingle()

    setPayroll(payrollData ?? null)

    if (payrollData) {
      const { data: itemData } = await supabase
        .from('payroll_items')
        .select('*')
        .eq('payroll_id', payrollData.id)
        .eq('employee_id', employee.id)
        .maybeSingle()
      setItem(itemData ?? null)
    } else {
      setItem(null)
    }

    // Histórico últimos 12 meses
    const { data: payrolls } = await supabase
      .from('payrolls')
      .select('*')
      .eq('company_id', user.company_id)
      .order('reference_month', { ascending: false })
      .limit(12)

    if (payrolls && payrolls.length > 0) {
      const ids = payrolls.map(p => p.id)
      const { data: items } = await supabase
        .from('payroll_items')
        .select('*')
        .in('payroll_id', ids)
        .eq('employee_id', employee.id)

      const hist = payrolls
        .map(p => ({ payroll: p, item: items?.find(i => i.payroll_id === p.id) }))
        .filter((x): x is { payroll: Payroll; item: PayrollItem } => !!x.item)

      setHistory(hist)
    }

    setLoading(false)
  }, [user, employee, refMonth])

  useEffect(() => { load() }, [load])

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  function printHolerite(p: Payroll, it: PayrollItem) {
    const adds  = ((it.other_additions  ?? []) as Extra[])
    const discs = ((it.other_discounts  ?? []) as Extra[])
    const w = window.open('', '_blank', 'width=480,height=700')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Holerite</title>
      <style>body{font-family:sans-serif;padding:32px;max-width:400px;margin:auto}
      h2{font-size:18px;margin-bottom:4px}p.sub{font-size:12px;color:#888;margin:0 0 16px}
      .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px}
      .red{color:#dc2626}.green{color:#16a34a}.bold{font-weight:700;font-size:15px}
      .section{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-top:12px;margin-bottom:4px;color:#888}
      </style></head><body>
      <h2>Holerite — ${employee!.full_name}</h2><p class="sub">${monthLabel(p.reference_month)}</p>
      <div class="row"><span>Salário bruto</span><span>${formatCurrency(it.gross_salary)}</span></div>
      ${adds.map(a => `<div class="row green"><span>${a.descricao}</span><span>+${formatCurrency(a.valor)}</span></div>`).join('')}
      <div class="section">Descontos</div>
      <div class="row red"><span>INSS (${((it.inss / it.gross_salary) * 100).toFixed(1)}%)</span><span>-${formatCurrency(it.inss)}</span></div>
      <div class="row red"><span>IRRF</span><span>-${formatCurrency(it.irrf)}</span></div>
      ${discs.map(d => `<div class="row red"><span>${d.descricao}</span><span>-${formatCurrency(d.valor)}</span></div>`).join('')}
      <div class="section">Encargos patronais</div>
      <div class="row" style="color:#888"><span>FGTS (8%)</span><span>${formatCurrency(it.fgts)}</span></div>
      <div class="row bold green" style="margin-top:8px"><span>Salário líquido</span><span>${formatCurrency(it.net_salary)}</span></div>
      </body></html>`)
    w.document.close(); w.focus(); w.print()
  }

  if (empLoading) return <div className="p-8 text-center text-gray-400">Carregando...</div>

  if (!employee) return (
    <div className="p-12 text-center">
      <AlertCircle className="h-10 w-10 text-yellow-400 mx-auto mb-3" />
      <p className="font-semibold text-gray-700">Perfil de funcionário não encontrado</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meus Holerites</h1>
        <p className="text-gray-500 mt-1">{employee.full_name}</p>
      </div>

      {/* Navegação mês */}
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-gray-100"><ChevronLeft className="h-5 w-5" /></button>
        <span className="font-semibold text-gray-800 capitalize w-52 text-center">{monthLabel(refMonth)}</span>
        <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-gray-100"><ChevronRight className="h-5 w-5" /></button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400">Carregando...</div>
      ) : !payroll || !item ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <DollarSign className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Holerite não disponível para este mês</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 max-w-md">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 capitalize">{monthLabel(payroll.reference_month)}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_LABELS[payroll.status].color}`}>
              {STATUS_LABELS[payroll.status].label}
            </span>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Salário bruto</span>
              <span className="font-medium">{formatCurrency(item.gross_salary)}</span>
            </div>
            {((item.other_additions ?? []) as Extra[]).map((a, i) => (
              <div key={i} className="flex justify-between text-green-600">
                <span>{a.descricao}</span><span>+{formatCurrency(a.valor)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between text-red-600">
              <span>INSS ({((item.inss / item.gross_salary) * 100).toFixed(1)}%)</span>
              <span>-{formatCurrency(item.inss)}</span>
            </div>
            <div className="flex justify-between text-red-600">
              <span>IRRF</span><span>-{formatCurrency(item.irrf)}</span>
            </div>
            {((item.other_discounts ?? []) as Extra[]).map((d, i) => (
              <div key={i} className="flex justify-between text-red-500">
                <span>{d.descricao}</span><span>-{formatCurrency(d.valor)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between text-gray-500 text-xs">
              <span>FGTS (8%)</span><span>{formatCurrency(item.fgts)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-green-700 font-bold text-base">
              <span>Salário líquido</span><span>{formatCurrency(item.net_salary)}</span>
            </div>
          </div>

          <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => printHolerite(payroll, item)}>
            <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
          </Button>
        </div>
      )}

      {/* Histórico */}
      {history.length > 1 && (
        <>
          <h2 className="text-lg font-semibold text-gray-800">Histórico</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {history.map(({ payroll: p, item: it }) => (
              <button
                key={p.id}
                onClick={() => { setDetailPayroll(p); setDetailItem(it) }}
                className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <p className="text-sm font-semibold text-gray-700 capitalize mb-1">{monthLabel(p.reference_month)}</p>
                <p className="text-xl font-bold text-green-700">{formatCurrency(it.net_salary)}</p>
                <p className="text-xs text-gray-400 mt-1">Bruto: {formatCurrency(it.gross_salary)}</p>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Dialog histórico */}
      <Dialog open={!!detailPayroll} onOpenChange={o => { if (!o) { setDetailPayroll(null); setDetailItem(null) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="capitalize">{detailPayroll ? monthLabel(detailPayroll.reference_month) : ''}</DialogTitle>
          </DialogHeader>
          {detailPayroll && detailItem && (
            <div className="space-y-2 text-sm pt-2">
              <div className="flex justify-between"><span className="text-gray-500">Salário bruto</span><span>{formatCurrency(detailItem.gross_salary)}</span></div>
              <Separator />
              <div className="flex justify-between text-red-600"><span>INSS</span><span>-{formatCurrency(detailItem.inss)}</span></div>
              <div className="flex justify-between text-red-600"><span>IRRF</span><span>-{formatCurrency(detailItem.irrf)}</span></div>
              <Separator />
              <div className="flex justify-between font-bold text-green-700"><span>Líquido</span><span>{formatCurrency(detailItem.net_salary)}</span></div>
              <Button variant="outline" size="sm" className="w-full gap-2 mt-2"
                onClick={() => printHolerite(detailPayroll, detailItem)}>
                <Printer className="h-4 w-4" /> Imprimir
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
