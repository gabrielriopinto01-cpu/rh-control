'use client'

import { useEffect, useState, useCallback } from 'react'
import { DollarSign, Calculator, Download, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { Label }  from '@/components/ui/label'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { calcINSS, calcIRRF } from '@/lib/payroll/tax'

export const dynamic = 'force-dynamic'

type Employee = {
  id: string; full_name: string; position?: string; salary: number
  hire_date: string; department?: { name: string }
}

type CalcRow = {
  employee:    Employee
  months:      number
  gross:       number
  inss:        number
  irrf:        number
  net:         number
  installment: number
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function monthsWorkedInYear(hireDateStr: string, refYear: number): number {
  const hire = new Date(hireDateStr)
  const start = hire.getFullYear() < refYear ? 1 : hire.getMonth() + 1
  return 13 - start // meses de start..12
}

export default function DecimoTerceiroPage() {
  const { user }    = useAuth()
  const [year,      setYear]       = useState(new Date().getFullYear())
  const [parcela,   setParcela]    = useState<1 | 2>(1)
  const [employees, setEmployees]  = useState<Employee[]>([])
  const [rows,      setRows]       = useState<CalcRow[]>([])
  const [loading,   setLoading]    = useState(true)
  const [search,    setSearch]     = useState('')

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) return
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('employees')
      .select('id, full_name, position, salary, hire_date, department:departments(name)')
      .eq('company_id', user.company_id)
      .eq('status', 'active')
      .order('full_name')
    setEmployees((data as unknown as Employee[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const calc: CalcRow[] = employees.map(emp => {
      const months = Math.min(12, Math.max(1, monthsWorkedInYear(emp.hire_date, year)))
      const gross  = (emp.salary / 12) * months
      const inss   = calcINSS(gross)
      const irrf   = calcIRRF(gross, inss)
      const net    = gross - inss - irrf
      const installment = parcela === 1 ? gross / 2 : net - gross / 2
      return { employee: emp, months, gross, inss, irrf, net, installment }
    })
    setRows(calc)
  }, [employees, year, parcela])

  const filtered = rows.filter(r =>
    r.employee.full_name.toLowerCase().includes(search.toLowerCase())
  )

  const totalGross       = filtered.reduce((s, r) => s + r.gross, 0)
  const totalInstallment = filtered.reduce((s, r) => s + r.installment, 0)

  const exportCSV = () => {
    const bom = '﻿'
    const header = 'Colaborador;Dept;Meses;Bruto 13º;INSS;IRRF;Líquido;Parcela\n'
    const lines  = filtered.map(r =>
      `"${r.employee.full_name}";"${(r.employee.department as any)?.name ?? '-'}";${r.months};${r.gross.toFixed(2)};${r.inss.toFixed(2)};${r.irrf.toFixed(2)};${r.net.toFixed(2)};${r.installment.toFixed(2)}`
    ).join('\n')
    const blob = new Blob([bom + header + lines], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `13-salario-${year}-parcela${parcela}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exportado com sucesso')
  }

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">13º Salário</h1>
          <p className="text-gray-500 text-sm mt-0.5">Cálculo proporcional com INSS e IRRF</p>
        </div>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <Label>Ano de referência</Label>
          <Input
            type="number" min={2020} max={2030}
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="w-32"
          />
        </div>
        <div className="space-y-1">
          <Label>Parcela</Label>
          <div className="flex gap-2">
            <button
              onClick={() => setParcela(1)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                parcela === 1 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
              }`}
            >1ª Parcela <span className="text-xs opacity-70">(nov/jun)</span></button>
            <button
              onClick={() => setParcela(2)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                parcela === 2 ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
              }`}
            >2ª Parcela <span className="text-xs opacity-70">(dez)</span></button>
          </div>
        </div>
        <div className="flex-1 space-y-1">
          <Label>Buscar colaborador</Label>
          <Input placeholder="Nome..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Totalizadores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <p className="text-xs text-blue-500 font-medium uppercase tracking-wide">Colaboradores</p>
          <p className="text-3xl font-bold text-blue-700 mt-1">{filtered.length}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
          <p className="text-xs text-purple-500 font-medium uppercase tracking-wide">Total Bruto 13º</p>
          <p className="text-3xl font-bold text-purple-700 mt-1">{formatCurrency(totalGross)}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
          <p className="text-xs text-green-500 font-medium uppercase tracking-wide">Total {parcela}ª Parcela</p>
          <p className="text-3xl font-bold text-green-700 mt-1">{formatCurrency(totalInstallment)}</p>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Colaborador</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Departamento</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Meses</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Bruto 13º</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">INSS</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">IRRF</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Líquido</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 bg-blue-50">{parcela}ª Parcela</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Calculando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Nenhum colaborador ativo encontrado</td></tr>
              ) : filtered.map(r => (
                <tr key={r.employee.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.employee.full_name}</div>
                    <div className="text-xs text-gray-400">{r.employee.position ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                    {(r.employee.department as any)?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold ${
                      r.months === 12 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>{r.months}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(r.gross)}</td>
                  <td className="px-4 py-3 text-right text-red-500 hidden lg:table-cell">-{formatCurrency(r.inss)}</td>
                  <td className="px-4 py-3 text-right text-red-500 hidden lg:table-cell">-{formatCurrency(r.irrf)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(r.net)}</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700 bg-blue-50">{formatCurrency(r.installment)}</td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-4 py-3 font-bold text-gray-900">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(totalGross)}</td>
                  <td colSpan={2} className="hidden lg:table-cell" />
                  <td className="px-4 py-3 text-right font-bold text-gray-900">—</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700 bg-blue-100">{formatCurrency(totalInstallment)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Legenda */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-semibold mb-1">ℹ️ Regras de cálculo (CLT)</p>
        <ul className="space-y-1 text-xs">
          <li>• <strong>1ª Parcela</strong> (venc. até 30/11): metade do salário bruto, sem desconto de INSS/IRRF</li>
          <li>• <strong>2ª Parcela</strong> (venc. até 20/12): salário líquido menos a 1ª parcela já paga</li>
          <li>• Proporcional: mínimo 15 dias trabalhados no mês contam como mês cheio</li>
          <li>• Tabelas INSS e IRRF 2025 aplicadas</li>
        </ul>
      </div>
    </div>
  )
}
