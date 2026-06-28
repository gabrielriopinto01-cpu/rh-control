'use client'

import { useState, useCallback, useRef } from 'react'
import { Receipt, Search, Loader2, Printer, User, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useBrandingStore } from '@/lib/store/branding-store'
import { calcDeductions } from '@/lib/payroll/tax'
import { formatCurrency } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type Employee = {
  id: string
  full_name: string
  cpf: string | null
  position: string | null
  hire_date: string | null
  salary: number | null
  department: { name: string } | null
}

type Extra = { descricao: string; valor: number }

type PayrollItem = {
  gross_salary: number
  inss: number
  irrf: number
  fgts: number
  net_salary: number
  other_discounts: Extra[] | null
  other_additions: Extra[] | null
}

type Company = {
  name: string
  cnpj: string | null
  address: string | null
  city: string | null
  state: string | null
}

function monthLabel(y: number, m: number) {
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function fmtPct(val: number, base: number) {
  if (!base) return ''
  return `(${((val / base) * 100).toFixed(2)}%)`
}

export default function HoleriteIndividualPage() {
  const { user }     = useAuth()
  const { branding } = useBrandingStore()

  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const [search,   setSearch]   = useState('')
  const [options,  setOptions]  = useState<{ id: string; full_name: string; position: string | null }[]>([])
  const [showOpts, setShowOpts] = useState(false)
  const [searching,setSearching]= useState(false)
  const [loading,  setLoading]  = useState(false)

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [item,     setItem]     = useState<PayrollItem | null>(null)
  const [company,  setCompany]  = useState<Company | null>(null)

  const printRef = useRef<HTMLDivElement>(null)

  const searchEmployees = useCallback(async (q: string) => {
    if (!isSupabaseConfigured() || !user?.company_id || q.length < 2) {
      setOptions([]); setShowOpts(false); return
    }
    setSearching(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('employees')
      .select('id, full_name, position')
      .eq('company_id', user.company_id)
      .eq('status', 'active')
      .ilike('full_name', `%${q}%`)
      .limit(8)
    setOptions(data ?? [])
    setShowOpts(true)
    setSearching(false)
  }, [user])

  const loadPayslip = useCallback(async (empId: string, y: number, m: number) => {
    if (!isSupabaseConfigured() || !user?.company_id) return
    setLoading(true)
    const ref = `${y}-${String(m).padStart(2, '0')}`
    const supabase = createClient()

    const [empRes, compRes, payrollRes] = await Promise.all([
      supabase.from('employees')
        .select('id, full_name, cpf, position, hire_date, salary, department:departments(name)')
        .eq('id', empId).single(),
      supabase.from('companies')
        .select('name, cnpj, address, city, state')
        .eq('id', user.company_id).single(),
      supabase.from('payrolls')
        .select('id, status')
        .eq('company_id', user.company_id)
        .eq('reference', ref)
        .maybeSingle(),
    ])

    if (empRes.data) setEmployee(empRes.data as unknown as Employee)
    if (compRes.data) setCompany(compRes.data as Company)

    if (payrollRes.data?.id) {
      const { data: pi } = await supabase.from('payroll_items')
        .select('gross_salary, inss, irrf, fgts, net_salary, other_discounts, other_additions')
        .eq('payroll_id', payrollRes.data.id)
        .eq('employee_id', empId)
        .maybeSingle()
      setItem(pi as PayrollItem | null)
    } else {
      setItem(null)
    }
    setLoading(false)
  }, [user])

  const selectEmployee = useCallback(async (opt: { id: string; full_name: string; position: string | null }) => {
    setShowOpts(false)
    setSearch(opt.full_name)
    await loadPayslip(opt.id, year, month)
  }, [year, month, loadPayslip])

  const changeMonth = useCallback((delta: number) => {
    let m = month + delta; let y = year
    if (m < 1)  { m = 12; y-- }
    if (m > 12) { m = 1;  y++ }
    setMonth(m); setYear(y)
    if (employee) loadPayslip(employee.id, y, m)
  }, [month, year, employee, loadPayslip])

  // Calcula encargos a partir do salário base se não houver item de folha
  const gross    = item?.gross_salary ?? employee?.salary ?? 0
  const computed = calcDeductions(gross)
  const inss     = item?.inss  ?? computed.inss
  const irrf     = item?.irrf  ?? computed.irrf
  const fgts     = item?.fgts  ?? computed.fgts

  const additions: Extra[]  = (item?.other_additions  ?? []) as Extra[]
  const discounts: Extra[]  = (item?.other_discounts   ?? []) as Extra[]

  const totalAdd  = additions.reduce((s, a) => s + a.valor, 0)
  const totalDisc = discounts.reduce((s, d) => s + d.valor, 0)
  const net       = item?.net_salary ?? (gross + totalAdd - inss - irrf - totalDisc)
  const totalDeducoes = inss + irrf + totalDisc

  function handlePrint() {
    if (!printRef.current) return
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) { toast.error('Permita popups para imprimir'); return }
    win.document.write(`
      <!DOCTYPE html><html lang="pt-BR"><head>
      <meta charset="UTF-8"/>
      <title>Holerite — ${employee?.full_name ?? ''} — ${monthLabel(year, month)}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #000; padding: 1.5cm 2cm; }
        .holerite { border: 2px solid #000; }
        .header { background: #1e293b; color: #fff; padding: 10px 14px; }
        .header h1 { font-size: 14pt; }
        .header p  { font-size: 9pt; opacity: 0.8; }
        .emp-section { border-bottom: 1px solid #000; padding: 10px 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
        .emp-section span { font-size: 9pt; }
        .emp-section .label { color: #555; font-size: 8pt; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #334155; color: #fff; padding: 5px 8px; font-size: 9pt; text-align: left; }
        td { padding: 4px 8px; font-size: 9pt; border-bottom: 1px solid #e5e7eb; }
        td.val { text-align: right; }
        tr.subtotal td { font-weight: bold; background: #f1f5f9; }
        .liquid { background: #1e293b; color: #fff; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; }
        .liquid .lbl { font-size: 9pt; }
        .liquid .val { font-size: 14pt; font-weight: bold; }
        .footer { padding: 8px 14px; font-size: 8pt; color: #555; display: flex; justify-content: space-between; border-top: 1px solid #ccc; margin-top: 24px; }
        .sig { display: flex; gap: 60px; margin-top: 32px; }
        .sig-line { flex: 1; text-align: center; }
        .sig-line hr { border: none; border-top: 1px solid #000; margin-bottom: 6px; }
        .sig-line p { font-size: 9pt; }
        @media print { body { padding: 0; } }
      </style></head>
      <body>${printRef.current.innerHTML}</body></html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 400)
  }

  const co  = company
  const emp = employee

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Receipt className="h-6 w-6" /> Holerite Individual
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Gere e imprima o contracheque de qualquer colaborador</p>
      </div>

      {/* Controles */}
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap gap-6 items-end">
          {/* Busca de colaborador */}
          <div className="relative flex-1 min-w-56">
            <Label className="mb-1.5 block">Colaborador</Label>
            <div className="relative">
              <Input
                placeholder="Pesquisar colaborador..."
                value={search}
                onChange={e => { setSearch(e.target.value); searchEmployees(e.target.value) }}
                onFocus={() => { if (options.length) setShowOpts(true) }}
                className="pr-8"
              />
              {searching
                ? <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                : <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              }
            </div>
            {showOpts && options.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg overflow-hidden">
                {options.map(o => (
                  <button
                    key={o.id}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-sm"
                    onClick={() => selectEmployee(o)}
                  >
                    <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="font-medium">{o.full_name}</span>
                    {o.position && <span className="text-gray-400 text-xs ml-auto">{o.position}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mês de referência */}
          <div className="flex-none">
            <Label className="mb-1.5 block">Competência</Label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => changeMonth(-1)}
                className="p-1.5 border rounded-md hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium w-36 text-center capitalize">
                {monthLabel(year, month)}
              </span>
              <button
                onClick={() => changeMonth(1)}
                className="p-1.5 border rounded-md hover:bg-gray-50"
                disabled={year >= now.getFullYear() && month >= now.getMonth() + 1}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {emp && (
            <Button className="gap-1.5 self-end" onClick={handlePrint}>
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          )}
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        )}
        {emp && !item && !loading && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
            Nenhuma folha fechada para {monthLabel(year, month)}. Exibindo cálculo estimado com base no salário atual.
          </p>
        )}
      </div>

      {/* Holerite */}
      {emp && co && !loading && (
        <div className="border-2 rounded-xl overflow-hidden shadow-sm" ref={printRef}>
          {/* Cabeçalho empresa */}
          <div className="bg-slate-800 text-white px-5 py-3 flex items-start justify-between">
            <div>
              <h2 className="font-bold text-base">{co.name}</h2>
              {co.cnpj && <p className="text-xs opacity-75">CNPJ: {co.cnpj}</p>}
              {(co.city || co.address) && (
                <p className="text-xs opacity-75">{[co.address, co.city, co.state].filter(Boolean).join(', ')}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs opacity-75 uppercase tracking-wide">Contracheque</p>
              <p className="font-semibold capitalize">{monthLabel(year, month)}</p>
            </div>
          </div>

          {/* Dados do colaborador */}
          <div className="px-5 py-3 border-b grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-4 text-sm bg-slate-50">
            {[
              { label: 'Colaborador', value: emp.full_name },
              { label: 'Cargo',       value: emp.position ?? '-' },
              { label: 'Departamento',value: (emp.department as { name: string } | null)?.name ?? '-' },
              { label: 'CPF',         value: emp.cpf ?? '-' },
              { label: 'Admissão',    value: emp.hire_date ? new Date(emp.hire_date + 'T00:00:00').toLocaleDateString('pt-BR') : '-' },
              { label: 'Sal. Base',   value: formatCurrency(emp.salary ?? 0) },
              { label: 'Competência', value: monthLabel(year, month) },
              { label: 'Tipo',        value: item ? 'Folha Fechada' : 'Estimativa' },
            ].map(f => (
              <div key={f.label}>
                <p className="text-[10px] uppercase tracking-wide text-gray-400">{f.label}</p>
                <p className="font-medium text-gray-800 truncate">{f.value}</p>
              </div>
            ))}
          </div>

          {/* Tabela de verbas e descontos */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="bg-slate-700 text-white text-left px-4 py-2 text-xs uppercase tracking-wider">Descrição</th>
                  <th className="bg-slate-700 text-white text-right px-4 py-2 text-xs uppercase tracking-wider w-32">Proventos</th>
                  <th className="bg-slate-700 text-white text-right px-4 py-2 text-xs uppercase tracking-wider w-32">Descontos</th>
                </tr>
              </thead>
              <tbody>
                {/* Salário base */}
                <tr>
                  <td className="px-4 py-2 border-b text-gray-700">Salário Base</td>
                  <td className="px-4 py-2 border-b text-right font-medium text-green-700">{formatCurrency(gross)}</td>
                  <td className="px-4 py-2 border-b text-right text-gray-300">—</td>
                </tr>

                {/* Adicionais */}
                {additions.map((a, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 border-b text-gray-700">{a.descricao}</td>
                    <td className="px-4 py-2 border-b text-right font-medium text-green-700">{formatCurrency(a.valor)}</td>
                    <td className="px-4 py-2 border-b text-right text-gray-300">—</td>
                  </tr>
                ))}

                {/* INSS */}
                <tr>
                  <td className="px-4 py-2 border-b text-gray-700">INSS {fmtPct(inss, gross)}</td>
                  <td className="px-4 py-2 border-b text-right text-gray-300">—</td>
                  <td className="px-4 py-2 border-b text-right font-medium text-red-600">{formatCurrency(inss)}</td>
                </tr>

                {/* IRRF */}
                {irrf > 0 && (
                  <tr>
                    <td className="px-4 py-2 border-b text-gray-700">IRRF {fmtPct(irrf, gross)}</td>
                    <td className="px-4 py-2 border-b text-right text-gray-300">—</td>
                    <td className="px-4 py-2 border-b text-right font-medium text-red-600">{formatCurrency(irrf)}</td>
                  </tr>
                )}

                {/* Outros descontos */}
                {discounts.map((d, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 border-b text-gray-700">{d.descricao}</td>
                    <td className="px-4 py-2 border-b text-right text-gray-300">—</td>
                    <td className="px-4 py-2 border-b text-right font-medium text-red-600">{formatCurrency(d.valor)}</td>
                  </tr>
                ))}

                {/* Subtotais */}
                <tr className="bg-slate-50">
                  <td className="px-4 py-2 font-semibold text-gray-800 text-xs uppercase">Totais</td>
                  <td className="px-4 py-2 text-right font-semibold text-green-700">{formatCurrency(gross + totalAdd)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-red-600">{formatCurrency(totalDeducoes)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Salário líquido */}
          <div className="bg-slate-800 text-white px-5 py-3 flex items-center justify-between">
            <span className="text-sm font-medium opacity-80">Salário Líquido a Receber</span>
            <span className="text-2xl font-bold">{formatCurrency(net)}</span>
          </div>

          {/* FGTS (informativo) */}
          <div className="px-5 py-2.5 bg-blue-50 border-t flex items-center gap-2 text-xs text-blue-700">
            <span className="font-semibold">FGTS (depósito empregador):</span>
            <span>{formatCurrency(fgts)}</span>
            <span className="opacity-60 ml-1">— não desconta do salário</span>
          </div>

          {/* Assinaturas */}
          <div className="px-5 py-5 border-t grid grid-cols-2 gap-16">
            <div className="text-center">
              <div className="border-t border-gray-400 pt-2 mt-8">
                <p className="text-xs font-medium">{co.name}</p>
                <p className="text-xs text-gray-400">Empregador</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-gray-400 pt-2 mt-8">
                <p className="text-xs font-medium">{emp.full_name}</p>
                {emp.cpf && <p className="text-xs text-gray-400">CPF: {emp.cpf}</p>}
              </div>
            </div>
          </div>

          {/* Rodapé */}
          <div className="px-5 py-2.5 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-400">
            <span>Documento emitido eletronicamente em {new Date().toLocaleDateString('pt-BR')}</span>
            <span>Desenvolvido por GRP Tecnologia</span>
          </div>
        </div>
      )}

      {!emp && !loading && (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-400">
          <Receipt className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhum colaborador selecionado</p>
          <p className="text-sm mt-1">Pesquise um colaborador e selecione a competência</p>
        </div>
      )}
    </div>
  )
}
