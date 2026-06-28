'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { FileText, Printer } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export const dynamic = 'force-dynamic'

function monthOptions() {
  const opts = []
  const now  = new Date()
  for (let i = 0; i < 12; i++) {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = d.toISOString().slice(0, 7)
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    opts.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) })
  }
  return opts
}

export default function EspelhoPontoPage() {
  const { user }     = useAuth()
  const months       = monthOptions()
  const [month, setMonth] = useState(months[0]!.value)
  const [empId, setEmpId] = useState('')
  const [emps,  setEmps]  = useState<Array<{ id: string; full_name: string }>>([])

  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    createClient()
      .from('employees')
      .select('id, full_name')
      .eq('company_id', user.company_id)
      .eq('status', 'active')
      .order('full_name')
      .then(({ data }) => setEmps(data ?? []))
  }, [user])

  function openReport(e?: React.FormEvent) {
    e?.preventDefault()
    const params = new URLSearchParams({ month })
    if (empId) params.set('employee_id', empId)
    window.open(`/api/reports/espelho-ponto?${params}`, '_blank')
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Espelho de Ponto</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Relatório legal conforme Portaria MTE 671/2021 — Art. 74 CLT
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> Gerar relatório
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={openReport} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Mês de referência</Label>
              <select value={month} onChange={e => setMonth(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Colaborador (opcional — deixe vazio para todos)</Label>
              <select value={empId} onChange={e => setEmpId(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="">Todos os colaboradores ativos</option>
                {emps.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex items-center gap-2">
                <Printer className="h-4 w-4" /> Gerar / Imprimir
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-muted/40">
        <CardContent className="pt-4 text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Sobre este relatório</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Gerado em conformidade com a Portaria MTE 671/2021</li>
            <li>Inclui entrada, saídas de almoço, saída e total de horas</li>
            <li>Faltas destacadas em vermelho, atrasos em amarelo</li>
            <li>Campos de assinatura do empregador e empregado</li>
            <li>Pronto para imprimir ou salvar como PDF</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
