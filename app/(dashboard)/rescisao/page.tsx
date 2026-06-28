'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, Printer, AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Label }    from '@/components/ui/label'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth }  from '@/hooks/use-auth'
import { calcINSS, calcIRRF } from '@/lib/payroll/tax'

export const dynamic = 'force-dynamic'

type Employee = {
  id: string; full_name: string; position?: string; salary: number; hire_date: string
}

type TipoRescisao =
  | 'sem_justa_causa'
  | 'com_justa_causa'
  | 'pedido_demissao'
  | 'acordo_mutuo'
  | 'fin_contrato'

const TIPO_LABELS: Record<TipoRescisao, string> = {
  sem_justa_causa: 'Dispensa sem justa causa',
  com_justa_causa: 'Dispensa com justa causa',
  pedido_demissao: 'Pedido de demissão',
  acordo_mutuo:    'Acordo mútuo (art. 484-A)',
  fin_contrato:    'Fim de contrato a prazo',
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function diffMonths(d1: Date, d2: Date): number {
  return (d2.getFullYear() - d1.getFullYear()) * 12 + d2.getMonth() - d1.getMonth()
}

type Verbas = {
  saldoSalario:        number
  feriasVencidas:      number
  feriasProporcionais: number
  decimoTerceiro:      number
  avisoPrevio:         number  // indenizado se sem justa causa
  fgts:                number
  multaFGTS:           number  // 40% ou 20% (acordo)
  totalBruto:          number
  inss:                number
  irrf:                number
  totalLiquido:        number
}

function calcRescisao(emp: Employee, tipo: TipoRescisao, demDate: Date): Verbas {
  const hire   = new Date(emp.hire_date)
  const salary = emp.salary
  const dayMs  = 86_400_000
  const totalMonths   = diffMonths(hire, demDate)
  const totalYears    = Math.floor(totalMonths / 12)
  const daysInMonth   = 30

  // Saldo de salário (dias trabalhados no mês corrente)
  const daysWorked = demDate.getDate()
  const saldoSalario = (salary / daysInMonth) * daysWorked

  // Férias vencidas (anos completos sem gozo)
  const feriasVencidas = tipo === 'com_justa_causa' ? 0 : salary * Math.max(0, totalYears)

  // Férias proporcionais: meses desde o último aniversário de contrato
  const monthsInPeriod = totalMonths % 12
  const feriasProporcionais = tipo === 'com_justa_causa' ? 0 : (salary / 12) * monthsInPeriod

  // 13º proporcional (meses no ano corrente)
  const monthsThisYear = demDate.getMonth() + 1 // jan=0 → jan=1
  const decimoTerceiro = (tipo === 'com_justa_causa' || tipo === 'pedido_demissao')
    ? 0
    : (salary / 12) * monthsThisYear

  // Aviso prévio indenizado (sem justa causa e acordo)
  let avisoPrevio = 0
  if (tipo === 'sem_justa_causa' || tipo === 'fin_contrato') {
    const extra = Math.min(60, Math.floor(totalYears * 3))
    avisoPrevio = salary * (1 + extra / 30)
  }
  if (tipo === 'acordo_mutuo') {
    avisoPrevio = salary / 2 // metade do aviso
  }

  // FGTS (estimativa: 8% × salário × meses)
  const fgts = salary * 0.08 * totalMonths

  // Multa FGTS
  let multaFGTS = 0
  if (tipo === 'sem_justa_causa' || tipo === 'fin_contrato') multaFGTS = fgts * 0.4
  if (tipo === 'acordo_mutuo') multaFGTS = fgts * 0.2

  const totalBruto = saldoSalario + feriasVencidas + feriasProporcionais + decimoTerceiro + avisoPrevio + multaFGTS
  // INSS incide sobre verbas salariais (exceto FGTS/multa/férias vencidas/aviso)
  const baseINSS = saldoSalario + feriasProporcionais + decimoTerceiro
  const inss = calcINSS(baseINSS)
  const irrf = calcIRRF(baseINSS, inss)
  const totalLiquido = totalBruto - inss - irrf

  return {
    saldoSalario, feriasVencidas, feriasProporcionais,
    decimoTerceiro, avisoPrevio, fgts, multaFGTS,
    totalBruto, inss, irrf, totalLiquido
  }
}

export default function RescisaoPage() {
  const { user }   = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [query,     setQuery]     = useState('')
  const [selected,  setSelected]  = useState<Employee | null>(null)
  const [tipo,      setTipo]      = useState<TipoRescisao>('sem_justa_causa')
  const [demDate,   setDemDate]   = useState(() => new Date().toISOString().slice(0, 10))
  const [verbas,    setVerbas]    = useState<Verbas | null>(null)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) return
    const supabase = createClient()
    const { data } = await supabase
      .from('employees')
      .select('id, full_name, position, salary, hire_date')
      .eq('company_id', user.company_id)
      .eq('status', 'active')
      .order('full_name')
    setEmployees((data as Employee[]) ?? [])
  }, [user])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!selected) return
    const v = calcRescisao(selected, tipo, new Date(demDate + 'T12:00:00'))
    setVerbas(v)
  }, [selected, tipo, demDate])

  const filtered = query
    ? employees.filter(e => e.full_name.toLowerCase().includes(query.toLowerCase()))
    : []

  const printRescisao = () => {
    if (!selected || !verbas) return
    const w = window.open('', '_blank', 'width=800,height=900')!
    w.document.write(`
      <!DOCTYPE html><html lang="pt-BR"><head>
      <meta charset="UTF-8"/><title>Rescisão — ${selected.full_name}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:40px;color:#111;max-width:700px;margin:0 auto}
        h1{font-size:20px;margin-bottom:4px}
        h2{font-size:14px;color:#555;font-weight:normal;margin-bottom:24px}
        table{width:100%;border-collapse:collapse;margin-bottom:20px}
        th{text-align:left;padding:8px 12px;background:#f3f4f6;font-size:12px;color:#555;border-bottom:1px solid #e5e7eb}
        td{padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px}
        td:last-child{text-align:right;font-weight:500}
        .total-row td{font-weight:bold;font-size:14px;border-top:2px solid #2563eb;color:#2563eb}
        .deduction td{color:#ef4444}
        .footer{text-align:center;margin-top:40px;font-size:11px;color:#9ca3af}
        @media print{button{display:none}}
      </style></head><body>
      <h1>Termo de Rescisão de Contrato</h1>
      <h2>${TIPO_LABELS[tipo]} — ${new Date(demDate + 'T12:00:00').toLocaleDateString('pt-BR')}</h2>
      <table>
        <tr><th>Colaborador</th><td>${selected.full_name}</td></tr>
        <tr><th>Cargo</th><td>${selected.position ?? '—'}</td></tr>
        <tr><th>Admissão</th><td>${new Date(selected.hire_date + 'T12:00:00').toLocaleDateString('pt-BR')}</td></tr>
        <tr><th>Demissão</th><td>${new Date(demDate + 'T12:00:00').toLocaleDateString('pt-BR')}</td></tr>
        <tr><th>Salário Base</th><td>${formatCurrency(selected.salary)}</td></tr>
      </table>
      <table>
        <tr><th>Verba</th><th>Valor</th></tr>
        <tr><td>Saldo de Salário</td><td>${formatCurrency(verbas.saldoSalario)}</td></tr>
        ${verbas.feriasVencidas > 0 ? `<tr><td>Férias Vencidas</td><td>${formatCurrency(verbas.feriasVencidas)}</td></tr>` : ''}
        ${verbas.feriasProporcionais > 0 ? `<tr><td>Férias Proporcionais + 1/3</td><td>${formatCurrency(verbas.feriasProporcionais * 1.333)}</td></tr>` : ''}
        ${verbas.decimoTerceiro > 0 ? `<tr><td>13º Salário Proporcional</td><td>${formatCurrency(verbas.decimoTerceiro)}</td></tr>` : ''}
        ${verbas.avisoPrevio > 0 ? `<tr><td>Aviso Prévio Indenizado</td><td>${formatCurrency(verbas.avisoPrevio)}</td></tr>` : ''}
        ${verbas.multaFGTS > 0 ? `<tr><td>Multa FGTS (${tipo === 'acordo_mutuo' ? '20' : '40'}%)</td><td>${formatCurrency(verbas.multaFGTS)}</td></tr>` : ''}
        <tr class="deduction"><td>(-) INSS</td><td>-${formatCurrency(verbas.inss)}</td></tr>
        <tr class="deduction"><td>(-) IRRF</td><td>-${formatCurrency(verbas.irrf)}</td></tr>
        <tr class="total-row"><td>TOTAL LÍQUIDO</td><td>${formatCurrency(verbas.totalLiquido)}</td></tr>
      </table>
      <div style="display:flex;gap:40px;margin-top:60px">
        <div style="flex:1;border-top:1px solid #ccc;padding-top:8px;text-align:center;font-size:12px">
          Assinatura do Empregador
        </div>
        <div style="flex:1;border-top:1px solid #ccc;padding-top:8px;text-align:center;font-size:12px">
          Assinatura do Colaborador
        </div>
      </div>
      <div class="footer">Gerado por RH Control em ${new Date().toLocaleDateString('pt-BR')}</div>
      </body></html>
    `)
    w.document.close()
    w.print()
  }

  return (
    <div className="space-y-6 p-1">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rescisão Trabalhista</h1>
        <p className="text-gray-500 text-sm mt-0.5">Cálculo automatizado de verbas rescisórias (CLT)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna esquerda — formulário */}
        <div className="space-y-4">

          {/* Busca colaborador */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <Label className="text-base font-semibold">1. Selecione o colaborador</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome..."
                value={selected ? selected.full_name : query}
                onChange={e => { setQuery(e.target.value); setSelected(null) }}
                className="pl-9"
              />
            </div>
            {filtered.length > 0 && !selected && (
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                {filtered.map(e => (
                  <button
                    key={e.id}
                    onClick={() => { setSelected(e); setQuery('') }}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors text-sm border-b border-gray-100 last:border-0"
                  >
                    <div className="font-medium text-gray-900">{e.full_name}</div>
                    <div className="text-xs text-gray-400">{e.position ?? '—'} · {formatCurrency(e.salary)}/mês</div>
                  </button>
                ))}
              </div>
            )}
            {selected && (
              <div className="bg-blue-50 rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-blue-800">{selected.full_name}</p>
                  <p className="text-xs text-blue-500">
                    Admitido em {new Date(selected.hire_date + 'T12:00:00').toLocaleDateString('pt-BR')} · {formatCurrency(selected.salary)}/mês
                  </p>
                </div>
                <button onClick={() => setSelected(null)} className="text-blue-400 hover:text-red-500 text-xs">✕</button>
              </div>
            )}
          </div>

          {/* Tipo de rescisão */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <Label className="text-base font-semibold">2. Motivo da rescisão</Label>
            <div className="space-y-2">
              {(Object.entries(TIPO_LABELS) as [TipoRescisao, string][]).map(([k, v]) => (
                <label key={k} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  tipo === k ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-200'
                }`}>
                  <input type="radio" name="tipo" value={k}
                    checked={tipo === k} onChange={() => setTipo(k)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-800">{v}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Data de demissão */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <Label className="text-base font-semibold">3. Data de demissão</Label>
            <Input type="date" value={demDate} onChange={e => setDemDate(e.target.value)} />
          </div>
        </div>

        {/* Coluna direita — resultado */}
        <div>
          {!selected ? (
            <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center h-80 text-gray-400">
              <AlertCircle className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-medium">Selecione um colaborador</p>
              <p className="text-sm">para calcular as verbas rescisórias</p>
            </div>
          ) : verbas && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">Verbas Rescisórias</h3>
                    <p className="text-xs text-gray-500">{TIPO_LABELS[tipo]}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={printRescisao}>
                    <Printer className="h-3.5 w-3.5 mr-1.5" /> Imprimir
                  </Button>
                </div>

                <div className="divide-y divide-gray-100">
                  {[
                    { label: 'Saldo de Salário',          val: verbas.saldoSalario,        show: true },
                    { label: 'Férias Vencidas',            val: verbas.feriasVencidas,       show: verbas.feriasVencidas > 0 },
                    { label: 'Férias Proporcionais + 1/3', val: verbas.feriasProporcionais * 1.333, show: verbas.feriasProporcionais > 0 },
                    { label: '13º Proporcional',           val: verbas.decimoTerceiro,       show: verbas.decimoTerceiro > 0 },
                    { label: 'Aviso Prévio Indenizado',    val: verbas.avisoPrevio,          show: verbas.avisoPrevio > 0 },
                    { label: `Multa FGTS (${tipo === 'acordo_mutuo' ? '20' : '40'}%)`, val: verbas.multaFGTS, show: verbas.multaFGTS > 0 },
                  ].filter(r => r.show).map(r => (
                    <div key={r.label} className="flex justify-between px-5 py-3 text-sm">
                      <span className="text-gray-600">{r.label}</span>
                      <span className="font-medium text-gray-900">{formatCurrency(r.val)}</span>
                    </div>
                  ))}

                  <div className="flex justify-between px-5 py-3 text-sm bg-gray-50 font-medium">
                    <span className="text-gray-700">Total Bruto</span>
                    <span className="text-gray-900">{formatCurrency(verbas.totalBruto)}</span>
                  </div>

                  <div className="flex justify-between px-5 py-3 text-sm">
                    <span className="text-red-500">(-) INSS</span>
                    <span className="text-red-500">-{formatCurrency(verbas.inss)}</span>
                  </div>
                  <div className="flex justify-between px-5 py-3 text-sm">
                    <span className="text-red-500">(-) IRRF</span>
                    <span className="text-red-500">-{formatCurrency(verbas.irrf)}</span>
                  </div>

                  <div className="flex justify-between px-5 py-4 bg-green-50">
                    <span className="text-green-800 font-bold text-base">Total Líquido</span>
                    <span className="text-green-700 font-bold text-xl">{formatCurrency(verbas.totalLiquido)}</span>
                  </div>
                </div>
              </div>

              {/* FGTS info */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-1">
                <p className="font-semibold">📋 FGTS acumulado estimado</p>
                <p>{formatCurrency(verbas.fgts)} (base para cálculo da multa)</p>
                <p className="text-amber-600">* Verifique o saldo real na conta FGTS do colaborador no FGTS Digital</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800">
                <p className="font-semibold mb-1">⚠️ Aviso legal</p>
                <p>Cálculo estimado com base nos dados cadastrados. Consulte um contador para validação antes do pagamento.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
