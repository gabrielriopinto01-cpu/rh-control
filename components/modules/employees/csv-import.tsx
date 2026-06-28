'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Download, X, AlertCircle, CheckCircle2, Loader2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

const TEMPLATE_HEADERS = ['full_name', 'cpf', 'email', 'phone', 'birth_date', 'hire_date', 'position', 'department', 'salary']
const TEMPLATE_EXAMPLE = [
  ['João Silva', '123.456.789-00', 'joao@empresa.com', '(11) 99999-0001', '1990-05-15', '2023-01-10', 'Analista', 'TI', '5000'],
  ['Maria Souza', '987.654.321-00', 'maria@empresa.com', '(11) 99999-0002', '1988-11-20', '2022-06-01', 'Coordenadora', 'RH', '7500'],
]

type ParsedRow = {
  full_name: string; cpf?: string; email?: string; phone?: string
  birth_date?: string; hire_date?: string; position?: string; department?: string; salary?: string
  _error?: string
}

type ImportResult = { imported: number; errors: { row: number; name: string; error: string }[] }

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

function downloadTemplate() {
  const rows = [TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLE]
  const csv  = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url
  a.download = 'modelo-importacao-colaboradores.csv'; a.click()
  URL.revokeObjectURL(url)
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0]!.split(',').map(h => h.replace(/"/g, '').trim().toLowerCase())
  return lines.slice(1).map(line => {
    const cols = line.match(/(".*?"|[^,]+)/g)?.map(c => c.replace(/^"|"$/g, '').trim()) ?? []
    const row: ParsedRow = { full_name: '' }
    headers.forEach((h, i) => { (row as any)[h] = cols[i] ?? '' })
    if (!row.full_name) row._error = 'Nome obrigatório'
    return row
  })
}

export function CsvImport({ open, onClose, onSuccess }: Props) {
  const inputRef    = useRef<HTMLInputElement>(null)
  const [rows,      setRows]      = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result,    setResult]    = useState<ImportResult | null>(null)
  const [dragging,  setDragging]  = useState(false)

  const reset = () => { setRows([]); setResult(null) }

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      if (parsed.length === 0) { toast.error('Nenhum dado encontrado no arquivo'); return }
      setRows(parsed); setResult(null)
    }
    reader.readAsText(file, 'utf-8')
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.csv')) handleFile(file)
    else toast.error('Envie um arquivo .csv')
  }

  const handleImport = async () => {
    const valid = rows.filter(r => !r._error)
    if (!valid.length) { toast.error('Nenhuma linha válida para importar'); return }
    setImporting(true)
    try {
      const res  = await fetch('/api/employees/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: valid }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erro na importação'); setImporting(false); return }
      setResult(data)
      if (data.imported > 0) { onSuccess(); toast.success(`${data.imported} colaborador(es) importado(s)!`) }
    } catch { toast.error('Erro ao importar') }
    setImporting(false)
  }

  const validRows   = rows.filter(r => !r._error)
  const invalidRows = rows.filter(r => !!r._error)

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-indigo-600" /> Importar Colaboradores via CSV
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Baixar modelo */}
          <div className="flex items-center justify-between bg-indigo-50 rounded-xl p-3">
            <div className="flex items-center gap-2 text-sm text-indigo-800">
              <FileText className="h-4 w-4" />
              Use o modelo para preencher os dados
            </div>
            <Button variant="outline" size="sm" className="gap-2 text-indigo-700 border-indigo-300" onClick={downloadTemplate}>
              <Download className="h-4 w-4" /> Baixar modelo .csv
            </Button>
          </div>

          {/* Drop zone */}
          {rows.length === 0 && !result && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
              }`}
            >
              <Upload className="h-8 w-8 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700">Arraste um arquivo .csv ou clique para selecionar</p>
              <p className="text-xs text-gray-400 mt-1">Apenas arquivos .csv. Máximo de 500 colaboradores por importação.</p>
              <input ref={inputRef} type="file" accept=".csv" className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </div>
          )}

          {/* Preview da planilha */}
          {rows.length > 0 && !result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-800">{rows.length} linha(s) encontradas</span>
                  {validRows.length > 0 && <Badge className="bg-green-100 text-green-700 border-0">{validRows.length} válidas</Badge>}
                  {invalidRows.length > 0 && <Badge variant="destructive">{invalidRows.length} com erro</Badge>}
                </div>
                <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <X className="h-3 w-3" /> Limpar
                </button>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-auto max-h-64">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {['Nome', 'CPF', 'E-mail', 'Cargo', 'Depto', 'Status'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((r, i) => (
                      <tr key={i} className={r._error ? 'bg-red-50' : ''}>
                        <td className="px-3 py-1.5 text-gray-800 font-medium">{r.full_name || '—'}</td>
                        <td className="px-3 py-1.5 text-gray-500">{r.cpf || '—'}</td>
                        <td className="px-3 py-1.5 text-gray-500">{r.email || '—'}</td>
                        <td className="px-3 py-1.5 text-gray-500">{r.position || '—'}</td>
                        <td className="px-3 py-1.5 text-gray-500">{r.department || '—'}</td>
                        <td className="px-3 py-1.5">
                          {r._error
                            ? <span className="text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{r._error}</span>
                            : <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />OK</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {invalidRows.length > 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  ⚠️ Linhas com erro serão ignoradas. Apenas {validRows.length} colaborador(es) será(ão) importado(s).
                </p>
              )}
            </div>
          )}

          {/* Resultado */}
          {result && (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
                <div>
                  <p className="font-semibold text-green-800">{result.imported} colaborador(es) importado(s) com sucesso</p>
                  {result.errors.length > 0 && (
                    <p className="text-xs text-green-700 mt-0.5">{result.errors.length} linha(s) ignorada(s) por erro</p>
                  )}
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-1">
                  <p className="text-xs font-semibold text-red-700 mb-1">Erros na importação:</p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600">Linha {e.row}: {e.name} — {e.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <Button variant="ghost" onClick={() => { reset(); onClose() }}>Fechar</Button>
          {rows.length > 0 && !result && (
            <Button onClick={handleImport} disabled={importing || validRows.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700">
              {importing
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</>
                : <><Upload className="h-4 w-4 mr-2" /> Importar {validRows.length} colaborador(es)</>
              }
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
