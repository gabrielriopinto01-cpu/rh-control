'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { BarChart3, Download, RefreshCw, Search } from 'lucide-react'

const REPORTS = [
  { value: 'employees',    label: 'Colaboradores',        hasDate: false },
  { value: 'vacations',    label: 'Férias',                hasDate: true  },
  { value: 'attendance',   label: 'Frequência / Ponto',    hasDate: true  },
  { value: 'payroll',      label: 'Folha de Pagamento',    hasDate: true  },
  { value: 'medical',      label: 'Atestados Médicos',     hasDate: true  },
  { value: 'birthdays',    label: 'Aniversariantes',       hasDate: false },
  { value: 'benefits',     label: 'Benefícios por Colaborador', hasDate: false },
  { value: 'okrs',         label: 'OKRs e Key Results',   hasDate: false },
  { value: 'trainings',    label: 'Treinamentos',          hasDate: true  },
  { value: 'turnover',      label: 'Turnover / Desligamentos',   hasDate: true  },
  { value: 'absenteeism',  label: 'Absenteísmo',              hasDate: true  },
  { value: 'warnings',     label: 'Advertências Disciplinares',hasDate: true  },
  { value: 'salary',       label: 'Reajustes Salariais',       hasDate: true  },
]

function toCSV(columns: string[], rows: any[][]) {
  const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const header = columns.map(escape).join(',')
  const body   = rows.map(r => r.map(escape).join(',')).join('\n')
  return `﻿${header}\n${body}`
}

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const [report, setReport] = useState('employees')
  const [from,   setFrom  ] = useState('')
  const [to,     setTo    ] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ columns: string[]; rows: any[][]; total: number } | null>(null)
  const [error, setError]   = useState('')

  const currentReport = REPORTS.find(r => r.value === report)!

  const fetchReport = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ report })
      if (from)   params.set('from', from)
      if (to)     params.set('to', to)
      if (status) params.set('status', status)
      const res = await fetch(`/api/reports/builder?${params}`)
      if (!res.ok) throw new Error(await res.text())
      setResult(await res.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [report, from, to, status])

  function handleExport() {
    if (!result) return
    const csv      = toCSV(result.columns, result.rows)
    const filename = `${report}_${new Date().toISOString().slice(0,10)}.csv`
    downloadCSV(filename, csv)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> Construtor de Relatórios
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Gere, filtre e exporte dados do sistema</p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>Relatório</Label>
              <select
                value={report}
                onChange={e => { setReport(e.target.value); setResult(null) }}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              >
                {REPORTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            {currentReport.hasDate && (
              <>
                <div className="space-y-1.5">
                  <Label>De</Label>
                  <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background" />
                </div>
                <div className="space-y-1.5">
                  <Label>Até</Label>
                  <input type="date" value={to} onChange={e => setTo(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background" />
                </div>
              </>
            )}

            {report === 'employees' && (
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select value={status} onChange={e => setStatus(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                  <option value="">Todos</option>
                  <option value="active">Ativos</option>
                  <option value="inactive">Inativos</option>
                  <option value="terminated">Desligados</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            <Button onClick={fetchReport} disabled={loading} className="flex items-center gap-2">
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? 'Gerando...' : 'Gerar relatório'}
            </Button>
            {result && (
              <Button variant="outline" onClick={handleExport} className="flex items-center gap-2">
                <Download className="h-4 w-4" /> Exportar CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {result && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>{currentReport.label}</span>
              <span className="text-muted-foreground text-sm font-normal">{result.total} registro{result.total !== 1 ? 's' : ''}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    {result.columns.map((col, i) => (
                      <th key={i} className="text-left px-3 py-2 bg-muted/50 border-b font-medium text-xs uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.length === 0 ? (
                    <tr>
                      <td colSpan={result.columns.length} className="text-center py-8 text-muted-foreground">
                        Nenhum registro encontrado
                      </td>
                    </tr>
                  ) : result.rows.map((row, ri) => (
                    <tr key={ri} className="border-b hover:bg-muted/30">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2 whitespace-nowrap">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
