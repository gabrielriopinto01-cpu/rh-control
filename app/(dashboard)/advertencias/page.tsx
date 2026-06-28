'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  AlertTriangle, Plus, Loader2, Search, Printer,
  CheckCircle2, Clock, XCircle, FileText, User,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type Warning = {
  id: string; employee_id: string; type: string; severity: string
  description: string; occurrence_date: string; status: string
  response: string | null; created_at: string
  employee?: { full_name: string; position?: { title: string } }
}
type Employee = { id: string; full_name: string }

const TYPE_LABELS: Record<string, string> = {
  verbal:         'Advertência Verbal',
  written:        'Advertência Escrita',
  suspension:     'Suspensão',
  termination_cause: 'Demissão por Justa Causa',
}
const SEV_CONFIG: Record<string, { label: string; color: string }> = {
  low:      { label: 'Leve',    color: 'bg-yellow-100 text-yellow-700' },
  medium:   { label: 'Média',   color: 'bg-orange-100 text-orange-700' },
  high:     { label: 'Grave',   color: 'bg-red-100 text-red-700' },
  critical: { label: 'Gravíssima', color: 'bg-red-200 text-red-900' },
}
const STATUS_CONFIG: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
  pending:    { label: 'Pendente',       icon: Clock,         color: 'bg-amber-100 text-amber-700' },
  delivered:  { label: 'Entregue',       icon: CheckCircle2,  color: 'bg-blue-100 text-blue-700' },
  signed:     { label: 'Assinada',       icon: CheckCircle2,  color: 'bg-green-100 text-green-700' },
  refused:    { label: 'Recusada p/ col.', icon: XCircle,     color: 'bg-red-100 text-red-700' },
}

const emptyForm = {
  employee_id: '', type: 'written', severity: 'medium',
  description: '', occurrence_date: new Date().toISOString().slice(0, 10), status: 'pending',
}

export default function AdvertenciasPage() {
  const { user } = useAuth()
  const [warnings,  setWarnings]  = useState<Warning[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [open,      setOpen]      = useState(false)
  const [form,      setForm]      = useState(emptyForm)
  const [saving,    setSaving]    = useState(false)
  const [viewId,    setViewId]    = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) return
    setLoading(true)
    const supabase = createClient()
    const [wRes, eRes] = await Promise.allSettled([
      supabase.from('employee_warnings')
        .select('*, employee:employees(full_name, position:positions(title))')
        .eq('company_id', user.company_id)
        .order('occurrence_date', { ascending: false }),
      supabase.from('employees')
        .select('id, full_name')
        .eq('company_id', user.company_id)
        .eq('status', 'active')
        .order('full_name'),
    ])
    setWarnings(wRes.status === 'fulfilled' ? (wRes.value.data as Warning[] ?? []) : [])
    setEmployees(eRes.status === 'fulfilled' ? (eRes.value.data ?? []) : [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const handleSubmit = async () => {
    if (!form.employee_id || !form.description.trim() || !form.occurrence_date) {
      toast.error('Preencha colaborador, data e descrição'); return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('employee_warnings').insert({
      company_id:      user!.company_id,
      employee_id:     form.employee_id,
      type:            form.type,
      severity:        form.severity,
      description:     form.description.trim(),
      occurrence_date: form.occurrence_date,
      status:          form.status,
      created_by:      user!.id,
    })
    setSaving(false)
    if (error) {
      if (error.message.includes('does not exist')) toast.error('Execute a migração SQL primeiro (20260628_warnings.sql)')
      else toast.error('Erro ao salvar advertência')
      return
    }
    toast.success('Advertência registrada!')
    setOpen(false); setForm(emptyForm); load()
  }

  const updateStatus = async (id: string, status: string) => {
    const supabase = createClient()
    await supabase.from('employee_warnings').update({ status }).eq('id', id)
    load()
  }

  const printWarning = (w: Warning) => {
    const emp  = w.employee?.full_name ?? '—'
    const pos  = (w.employee?.position as any)?.title ?? ''
    const html = `
      <!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Advertência — ${emp}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; }
        h1 { text-align: center; font-size: 18px; text-transform: uppercase; margin-bottom: 4px; }
        .sub { text-align: center; font-size: 13px; color: #555; margin-bottom: 24px; }
        .field { margin-bottom: 12px; font-size: 13px; }
        .field b { display: inline-block; min-width: 130px; }
        .desc { border: 1px solid #ccc; border-radius: 6px; padding: 12px; margin: 16px 0; font-size: 13px; min-height: 80px; }
        .signs { display: flex; justify-content: space-around; margin-top: 48px; text-align: center; font-size: 12px; }
        .sign-line { border-top: 1px solid #333; padding-top: 6px; width: 180px; }
      </style></head><body>
      <h1>${TYPE_LABELS[w.type] ?? w.type}</h1>
      <div class="sub">${new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' })}</div>
      <div class="field"><b>Colaborador:</b> ${emp}</div>
      ${pos ? `<div class="field"><b>Cargo:</b> ${pos}</div>` : ''}
      <div class="field"><b>Tipo:</b> ${TYPE_LABELS[w.type] ?? w.type} — ${SEV_CONFIG[w.severity]?.label ?? ''}</div>
      <div class="field"><b>Data do fato:</b> ${formatDate(w.occurrence_date)}</div>
      <div class="field"><b>Descrição:</b></div>
      <div class="desc">${w.description.replace(/\n/g, '<br>')}</div>
      <p style="font-size:12px;color:#555">A presente advertência é expedida em conformidade com a Consolidação das Leis do Trabalho (CLT) e poderá ser considerada para efeitos de justa causa em caso de reincidência.</p>
      <div class="signs">
        <div><div class="sign-line">Responsável RH / Gestor</div></div>
        <div><div class="sign-line">Colaborador — ${emp}</div></div>
      </div>
      </body></html>`
    const w2 = window.open('', '_blank')!
    w2.document.write(html); w2.document.close(); w2.focus(); w2.print()
  }

  const filtered = warnings.filter(w =>
    !search || (w.employee?.full_name ?? '').toLowerCase().includes(search.toLowerCase())
  )
  const viewing = viewId ? warnings.find(w => w.id === viewId) : null

  const stats = [
    { label: 'Total', value: warnings.length, color: 'text-gray-700' },
    { label: 'Pendentes', value: warnings.filter(w => w.status === 'pending').length, color: 'text-amber-600' },
    { label: 'Este mês', value: warnings.filter(w => w.occurrence_date.startsWith(new Date().toISOString().slice(0,7))).length, color: 'text-blue-600' },
    { label: 'Graves', value: warnings.filter(w => w.severity === 'high' || w.severity === 'critical').length, color: 'text-red-600' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" /> Advertências e Ações Disciplinares
          </h1>
          <p className="text-gray-500 mt-1">Registro e controle de ocorrências disciplinares</p>
        </div>
        {(user?.role === 'adm_total' || user?.role === 'rh') && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova advertência
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <Input className="pl-9" placeholder="Buscar por colaborador..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle2 className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Nenhuma advertência registrada</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Colaborador', 'Tipo', 'Gravidade', 'Data', 'Status', 'Ações'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(w => {
                const sev    = SEV_CONFIG[w.severity]
                const status = STATUS_CONFIG[w.status]
                const StatusIcon = status?.icon ?? Clock
                return (
                  <tr key={w.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{w.employee?.full_name ?? '—'}</p>
                      {(w.employee?.position as any)?.title && (
                        <p className="text-xs text-gray-400">{(w.employee?.position as any).title}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{TYPE_LABELS[w.type] ?? w.type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${sev?.color ?? ''}`}>
                        {sev?.label ?? w.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(w.occurrence_date)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status?.color ?? ''}`}>
                        <StatusIcon className="h-3 w-3" />
                        {status?.label ?? w.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => setViewId(w.id)}>
                          <FileText className="h-3.5 w-3.5" /> Ver
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => printWarning(w)}>
                          <Printer className="h-3.5 w-3.5" /> Imprimir
                        </Button>
                        {w.status === 'pending' && (
                          <Select value={w.status} onValueChange={(v) => updateStatus(w.id, v ?? 'pending')}>
                            <SelectTrigger className="h-7 text-xs w-28 border-gray-200">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nova advertência */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setForm(emptyForm) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Nova Advertência
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Colaborador *</Label>
              <Select value={form.employee_id} onValueChange={v => setForm(f => ({ ...f, employee_id: v ?? '' }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo *</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v ?? 'written' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Gravidade *</Label>
                <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v ?? 'medium' }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEV_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Data do fato *</Label>
              <Input type="date" className="mt-1" value={form.occurrence_date}
                onChange={e => setForm(f => ({ ...f, occurrence_date: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição da ocorrência *</Label>
              <Textarea rows={4} className="mt-1" placeholder="Descreva detalhadamente o comportamento ou fato ocorrido..."
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => { setOpen(false); setForm(emptyForm) }}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Registrar advertência
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal visualizar */}
      <Dialog open={!!viewId} onOpenChange={v => { if (!v) setViewId(null) }}>
        {viewing && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5" /> {viewing.employee?.full_name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex gap-2 flex-wrap">
                <Badge className={SEV_CONFIG[viewing.severity]?.color}>{SEV_CONFIG[viewing.severity]?.label}</Badge>
                <Badge className={STATUS_CONFIG[viewing.status]?.color}>{STATUS_CONFIG[viewing.status]?.label}</Badge>
                <Badge variant="outline">{TYPE_LABELS[viewing.type] ?? viewing.type}</Badge>
              </div>
              <div className="text-gray-500 text-xs">Data do fato: {formatDate(viewing.occurrence_date)}</div>
              <div className="bg-gray-50 rounded-lg p-3 text-gray-700 whitespace-pre-wrap">{viewing.description}</div>
              {viewing.response && (
                <div>
                  <p className="font-medium text-gray-700 mb-1">Resposta do colaborador:</p>
                  <div className="bg-blue-50 rounded-lg p-3 text-gray-700">{viewing.response}</div>
                </div>
              )}
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => printWarning(viewing)}>
                  <Printer className="h-4 w-4 mr-2" /> Imprimir
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
