'use client'

import { useEffect, useState, useCallback } from 'react'
import { Clock, UserCheck, UserX, AlertCircle, Plus, ChevronLeft, ChevronRight, Download, MapPin, Globe, Smartphone, ShieldAlert, ShieldCheck, Camera } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatDate } from '@/lib/utils'
import type { AttendanceRecord, Employee, AttendanceStatus, AttendancePunch, PunchKind } from '@/types/database'

export const dynamic = 'force-dynamic'

const STATUS_MAP: Record<AttendanceStatus, { label: string; color: string }> = {
  present:  { label: 'Presente',     color: 'bg-green-100 text-green-700' },
  absent:   { label: 'Faltou',       color: 'bg-red-100 text-red-700' },
  late:     { label: 'Atrasado',     color: 'bg-yellow-100 text-yellow-700' },
  half_day: { label: 'Meio período', color: 'bg-blue-100 text-blue-700' },
  holiday:  { label: 'Feriado',      color: 'bg-purple-100 text-purple-700' },
  vacation: { label: 'Férias',       color: 'bg-indigo-100 text-indigo-700' },
}

const PUNCH_LABELS: Record<PunchKind, string> = {
  in: 'Entrada', lunch_start: 'Início do almoço', lunch_end: 'Retorno do almoço', out: 'Saída',
}

/** Extrai um nome amigável do User-Agent. */
function shortDevice(ua: string): string {
  if (/iphone/i.test(ua)) return 'iPhone'
  if (/ipad/i.test(ua)) return 'iPad'
  if (/android/i.test(ua)) return 'Android'
  if (/windows/i.test(ua)) return 'Windows'
  if (/macintosh|mac os/i.test(ua)) return 'Mac'
  if (/linux/i.test(ua)) return 'Linux'
  return ua.slice(0, 24)
}

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month, 1)
  const end   = new Date(year, month + 1, 0)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

// Calcula horas trabalhadas a partir de clock_in, clock_out, lunch_start, lunch_end
function calcHours(clockIn: string, clockOut: string, lunchStart: string, lunchEnd: string): number | null {
  if (!clockIn || !clockOut) return null
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  let worked = toMin(clockOut) - toMin(clockIn)
  if (lunchStart && lunchEnd) worked -= (toMin(lunchEnd) - toMin(lunchStart))
  if (worked < 0) return null
  return +(worked / 60).toFixed(2)
}

function formatHours(h: number | null) {
  if (h === null) return '—'
  const hrs = Math.floor(h)
  const min = Math.round((h - hrs) * 60)
  return `${hrs}h${min > 0 ? `${String(min).padStart(2, '0')}m` : ''}`
}

function exportCSV(records: AttendanceRecord[], employees: Employee[], monthLabel: string) {
  const getEmpName = (id: string) => employees.find(e => e.id === id)?.full_name ?? id
  const header = 'Colaborador,Data,Entrada,Saída,Início Almoço,Fim Almoço,Horas,Status,Observação'
  const rows = records.map(r => {
    const hrs = calcHours(r.clock_in ?? '', r.clock_out ?? '', r.lunch_start ?? '', r.lunch_end ?? '')
    return [
      `"${getEmpName(r.employee_id)}"`,
      r.date,
      r.clock_in   ?? '',
      r.clock_out  ?? '',
      r.lunch_start ?? '',
      r.lunch_end  ?? '',
      hrs !== null ? hrs.toString().replace('.', ',') : '',
      STATUS_MAP[r.status]?.label ?? r.status,
      `"${r.notes ?? ''}"`,
    ].join(',')
  })
  const csv  = [header, ...rows].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `ponto_${monthLabel.replace(/\s/g, '_')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

type FormState = {
  employee_id: string; date: string
  clock_in: string; clock_out: string; lunch_start: string; lunch_end: string
  status: AttendanceStatus; notes: string
}

export default function AttendancePage() {
  const { user } = useAuth()
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const [employees,  setEmployees]  = useState<Employee[]>([])
  const [records,    setRecords]    = useState<AttendanceRecord[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filterEmp,  setFilterEmp]  = useState('all')
  const [dialog,     setDialog]     = useState(false)
  const [editingRec, setEditingRec] = useState<AttendanceRecord | null>(null)
  const [detailRec,  setDetailRec]  = useState<AttendanceRecord | null>(null)
  const [punches,    setPunches]    = useState<AttendancePunch[]>([])
  const [loadingPunches, setLoadingPunches] = useState(false)

  const blankForm = (): FormState => ({
    employee_id: '', date: today.toISOString().slice(0, 10),
    clock_in: '', clock_out: '', lunch_start: '', lunch_end: '',
    status: 'present', notes: '',
  })
  const [form, setForm] = useState<FormState>(blankForm)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const supabase = createClient()
    const { start, end } = getMonthRange(year, month)
    const [e, r] = await Promise.all([
      supabase.from('employees').select('*').eq('company_id', user.company_id).eq('status', 'active').order('full_name'),
      supabase.from('attendance_records').select('*').eq('company_id', user.company_id)
        .gte('date', start).lte('date', end).order('date', { ascending: false }),
    ])
    setEmployees(e.data ?? [])
    setRecords(r.data ?? [])
    setLoading(false)
  }, [user, year, month])

  useEffect(() => { load() }, [load])

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  const openCreate = () => { setEditingRec(null); setForm(blankForm()); setDialog(true) }
  const openEdit   = (rec: AttendanceRecord) => {
    setEditingRec(rec)
    setForm({
      employee_id: rec.employee_id, date: rec.date,
      clock_in:    rec.clock_in    ?? '', clock_out:   rec.clock_out   ?? '',
      lunch_start: rec.lunch_start ?? '', lunch_end:   rec.lunch_end   ?? '',
      status: rec.status, notes: rec.notes ?? '',
    })
    setDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured() || !user) return
    if (!form.employee_id || !form.date) { toast.error('Colaborador e data são obrigatórios'); return }
    const supabase = createClient()
    const total_hours = calcHours(form.clock_in, form.clock_out, form.lunch_start, form.lunch_end)
    // Horas extras: acima de 8h
    const overtime = total_hours !== null && total_hours > 8 ? +(total_hours - 8).toFixed(2) : null
    const payload = {
      company_id: user.company_id, employee_id: form.employee_id, date: form.date,
      clock_in:    form.clock_in    || null,
      clock_out:   form.clock_out   || null,
      lunch_start: form.lunch_start || null,
      lunch_end:   form.lunch_end   || null,
      total_hours, overtime,
      status: form.status, notes: form.notes || null,
    }
    if (editingRec) {
      const { error } = await supabase.from('attendance_records').update(payload).eq('id', editingRec.id)
      if (error) { toast.error('Erro ao atualizar'); return }
      toast.success('Registro atualizado!')
    } else {
      const { error } = await supabase.from('attendance_records').insert(payload)
      if (error) {
        if (error.code === '23505') { toast.error('Já existe um registro para este colaborador nesta data'); return }
        toast.error('Erro ao registrar'); return
      }
      toast.success('Ponto registrado!')
    }
    setDialog(false)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este registro?')) return
    const supabase = createClient()
    const { error } = await supabase.from('attendance_records').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Registro excluído')
    load()
  }

  const openDetail = async (rec: AttendanceRecord) => {
    setDetailRec(rec)
    setPunches([])
    if (!isSupabaseConfigured()) return
    setLoadingPunches(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('attendance_punches')
      .select('*')
      .eq('record_id', rec.id)
      .order('punched_at', { ascending: true })
    setPunches((data as AttendancePunch[]) ?? [])
    setLoadingPunches(false)
  }

  const getEmpName = (id: string) => employees.find(e => e.id === id)?.full_name ?? '—'
  const filtered   = filterEmp === 'all' ? records : records.filter(r => r.employee_id === filterEmp)

  const stats = {
    present:    records.filter(r => r.status === 'present').length,
    absent:     records.filter(r => r.status === 'absent').length,
    late:       records.filter(r => r.status === 'late').length,
    totalHours: records.reduce((s, r) => s + (r.total_hours ?? 0), 0),
    overtime:   records.reduce((s, r) => s + (r.overtime   ?? 0), 0),
  }

  const monthLabelStr = new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  // Preview de horas no formulário
  const previewHours = calcHours(form.clock_in, form.clock_out, form.lunch_start, form.lunch_end)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Controle de Ponto</h1>
          <p className="text-gray-500 mt-1">Registro de frequência dos colaboradores</p>
        </div>
        <div className="flex gap-2">
          {records.length > 0 && (
            <Button variant="outline" onClick={() => exportCSV(filtered, employees, monthLabelStr)}>
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
          )}
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Registrar ponto</Button>
        </div>
      </div>

      {/* Navegação mês */}
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-gray-100"><ChevronLeft className="h-5 w-5" /></button>
        <span className="font-semibold text-gray-800 capitalize w-52 text-center">{monthLabelStr}</span>
        <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-gray-100"><ChevronRight className="h-5 w-5" /></button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Presenças',    value: stats.present,                   Icon: UserCheck,   color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Faltas',       value: stats.absent,                    Icon: UserX,       color: 'text-red-600',    bg: 'bg-red-50' },
          { label: 'Atrasos',      value: stats.late,                      Icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Total horas',  value: formatHours(stats.totalHours),   Icon: Clock,       color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Horas extras', value: formatHours(stats.overtime),     Icon: Clock,       color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(({ label, value, Icon, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4 flex items-center gap-3`}>
            <Icon className={`h-6 w-6 ${color} shrink-0`} />
            <div className="min-w-0">
              <p className="text-lg font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-600 truncate">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtro */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">Filtrar por:</span>
        <Select defaultValue="all" onValueChange={(v) => setFilterEmp(v ?? 'all')}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os colaboradores</SelectItem>
            {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Nenhum registro neste mês</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Colaborador','Data','Entrada','Saída','Horas','Extras','Status',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(rec => {
                const s   = STATUS_MAP[rec.status]
                const hrs = rec.total_hours ?? calcHours(rec.clock_in ?? '', rec.clock_out ?? '', rec.lunch_start ?? '', rec.lunch_end ?? '')
                const ot  = rec.overtime ?? (hrs !== null && hrs > 8 ? +(hrs - 8).toFixed(2) : null)
                return (
                  <tr key={rec.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{getEmpName(rec.employee_id)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(rec.date)}</td>
                    <td className="px-4 py-3 text-gray-600">{rec.clock_in ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{rec.clock_out ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-blue-700">{formatHours(hrs)}</td>
                    <td className="px-4 py-3 text-purple-600 text-xs">{ot && ot > 0 ? `+${formatHours(ot)}` : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openDetail(rec)} className="text-xs px-2 py-1 rounded hover:bg-blue-50 text-blue-500">Detalhes</button>
                        <button onClick={() => openEdit(rec)} className="text-xs px-2 py-1 rounded hover:bg-gray-100 text-gray-500">Editar</button>
                        <button onClick={() => handleDelete(rec.id)} className="text-xs px-2 py-1 rounded hover:bg-red-50 text-red-400">Excluir</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Espelho de ponto — detalhes das batidas */}
      <Dialog open={!!detailRec} onOpenChange={(o) => { if (!o) setDetailRec(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" /> Espelho de ponto
            </DialogTitle>
          </DialogHeader>
          {detailRec && (
            <div className="space-y-1">
              <p className="text-sm text-gray-500">
                {getEmpName(detailRec.employee_id)} · {formatDate(detailRec.date)}
              </p>
            </div>
          )}
          <div className="max-h-[60vh] overflow-y-auto space-y-3 pt-1">
            {loadingPunches ? (
              <p className="text-sm text-gray-400 py-6 text-center">Carregando batidas...</p>
            ) : punches.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">
                Nenhuma batida com geolocalização registrada para este dia.
              </p>
            ) : punches.map(p => {
              const label = PUNCH_LABELS[p.kind]
              const time  = new Date(p.punched_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              return (
                <div key={p.id} className="flex gap-3 border border-gray-200 rounded-xl p-3">
                  {p.selfie_url ? (
                    <a href={p.selfie_url} target="_blank" rel="noreferrer" className="shrink-0">
                      <img src={p.selfie_url} alt="Selfie" className="h-16 w-16 rounded-lg object-cover border border-gray-200" />
                    </a>
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <Camera className="h-5 w-5 text-gray-300" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-gray-900">{label}</span>
                      <span className="text-gray-500">{time}</span>
                    </div>
                    {(p.latitude != null && p.longitude != null) && (
                      <a
                        href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}
                        target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:underline mt-1"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="truncate">{p.address ?? `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`}</span>
                      </a>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-400">
                      {p.ip && <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{p.ip}</span>}
                      {p.device && <span className="flex items-center gap-1 truncate max-w-[180px]"><Smartphone className="h-3 w-3" />{shortDevice(p.device)}</span>}
                    </div>
                    {p.within_fence != null && (
                      <span className={`inline-flex items-center gap-1 mt-2 text-xs px-2 py-0.5 rounded-full border ${
                        p.within_fence
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {p.within_fence ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                        {p.within_fence ? 'Dentro da cerca' : 'Fora da cerca'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRec ? 'Editar registro' : 'Registrar ponto'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Colaborador *</Label>
              <Select defaultValue={form.employee_id || undefined}
                onValueChange={(v) => setForm(f => ({ ...f, employee_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data *</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Status *</Label>
                <Select defaultValue={form.status}
                  onValueChange={(v) => setForm(f => ({ ...f, status: (v ?? 'present') as AttendanceStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_MAP).map(([v, { label }]) => (
                      <SelectItem key={v} value={v}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([
                ['clock_in',    'Entrada'],
                ['clock_out',   'Saída'],
                ['lunch_start', 'Início almoço'],
                ['lunch_end',   'Fim almoço'],
              ] as const).map(([field, label]) => (
                <div key={field} className="space-y-1.5">
                  <Label>{label}</Label>
                  <Input type="time" value={form[field]}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [field]: e.target.value }))} />
                </div>
              ))}
            </div>
            {previewHours !== null && (
              <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg text-sm">
                <span className="text-blue-700 font-medium">
                  Total: <strong>{formatHours(previewHours)}</strong>
                </span>
                {previewHours > 8 && (
                  <span className="text-purple-600 font-medium">
                    Extras: <strong>+{formatHours(previewHours - 8)}</strong>
                  </span>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Observação</Label>
              <Textarea rows={2} placeholder="Opcional..." value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
