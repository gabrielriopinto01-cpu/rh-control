'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Stethoscope, Plus, Trash2, ExternalLink, Loader2, Search, CalendarDays, TrendingDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatDate } from '@/lib/utils'
import type { MedicalCertificate, Employee } from '@/types/database'

export const dynamic = 'force-dynamic'

type FormState = {
  employee_id: string; doctor_name: string; crm: string; cid: string
  start_date: string; days: string; file_url: string; notes: string
}

export default function AtestadosPage() {
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  const [certs,      setCerts]      = useState<MedicalCertificate[]>([])
  const [employees,  setEmployees]  = useState<Employee[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [filterEmp,  setFilterEmp]  = useState('all')
  const [dialog,     setDialog]     = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const blank = (): FormState => ({
    employee_id: '', doctor_name: '', crm: '', cid: '',
    start_date: new Date().toISOString().slice(0, 10), days: '1', file_url: '', notes: '',
  })
  const [form, setForm] = useState<FormState>(blank)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const supabase = createClient()
    const [cRes, eRes] = await Promise.all([
      supabase.from('medical_certificates').select('*').eq('company_id', user.company_id).order('start_date', { ascending: false }),
      supabase.from('employees').select('id, full_name').eq('company_id', user.company_id).eq('status', 'active').order('full_name'),
    ])
    setCerts((cRes.data as MedicalCertificate[]) ?? [])
    setEmployees((eRes.data as Employee[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const empName = (id: string) => employees.find(e => e.id === id)?.full_name ?? '—'

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured() || !user) return
    if (!form.employee_id || !form.start_date) { toast.error('Colaborador e data são obrigatórios'); return }
    setSaving(true)
    const supabase = createClient()

    let fileUrl = form.file_url
    if (selectedFile) {
      const ext  = selectedFile.name.split('.').pop()
      const path = `${user.company_id}/atestados/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('documents').upload(path, selectedFile, { upsert: true })
      if (upErr) { toast.error('Erro ao enviar o arquivo'); setSaving(false); return }
      fileUrl = supabase.storage.from('documents').getPublicUrl(path).data.publicUrl
    }

    const { error } = await supabase.from('medical_certificates').insert({
      company_id: user.company_id, employee_id: form.employee_id,
      doctor_name: form.doctor_name || null, crm: form.crm || null, cid: form.cid || null,
      start_date: form.start_date, days: Number(form.days) || 1,
      file_url: fileUrl || null, notes: form.notes || null, created_by: user.id,
    })
    setSaving(false)
    if (error) { toast.error('Erro ao salvar atestado'); return }
    toast.success('Atestado registrado!')
    setForm(blank()); setSelectedFile(null); setDialog(false)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este atestado?')) return
    const supabase = createClient()
    const { error } = await supabase.from('medical_certificates').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Atestado excluído')
    load()
  }

  // Estatísticas do mês corrente
  const now = new Date()
  const monthCerts = certs.filter(c => {
    const d = new Date(c.start_date)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const daysThisMonth = monthCerts.reduce((s, c) => s + (c.days ?? 0), 0)
  // Absenteísmo aproximado: dias de atestado / (colaboradores ativos × ~22 dias úteis)
  const workdays = 22
  const absenteeism = employees.length > 0
    ? ((daysThisMonth / (employees.length * workdays)) * 100).toFixed(1)
    : '0.0'

  const filtered = certs.filter(c => {
    if (filterEmp !== 'all' && c.employee_id !== filterEmp) return false
    if (search && !empName(c.employee_id).toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const stats = [
    { label: 'Atestados (mês)',  value: monthCerts.length,        Icon: Stethoscope, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Dias afastados',   value: daysThisMonth,            Icon: CalendarDays, color: 'text-red-600',    bg: 'bg-red-50' },
    { label: 'Absenteísmo',      value: `${absenteeism}%`,        Icon: TrendingDown, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Total registros',  value: certs.length,             Icon: Stethoscope, color: 'text-blue-600',   bg: 'bg-blue-50' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Atestados</h1>
          <p className="text-gray-500 mt-1">Atestados médicos e absenteísmo</p>
        </div>
        <Button onClick={() => { setForm(blank()); setSelectedFile(null); setDialog(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Novo atestado
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(({ label, value, Icon, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4 flex items-center gap-3`}>
            <Icon className={`h-5 w-5 ${color} shrink-0`} />
            <div>
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input className="pl-9" placeholder="Buscar colaborador..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterEmp} onValueChange={(v) => setFilterEmp(v ?? 'all')}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os colaboradores</SelectItem>
            {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Stethoscope className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Nenhum atestado registrado</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Colaborador','Início','Dias','Médico','CRM','CID','',''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{empName(c.employee_id)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(c.start_date)}</td>
                  <td className="px-4 py-3 text-gray-600">{c.days}</td>
                  <td className="px-4 py-3 text-gray-600">{c.doctor_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.crm ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.cid ?? '—'}</td>
                  <td className="px-4 py-3">
                    {c.file_url && (
                      <a href={c.file_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Stethoscope className="h-4 w-4" /> Novo atestado</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Colaborador *</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm(f => ({ ...f, employee_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Data de início *</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Dias *</Label>
                <Input type="number" min="1" value={form.days} onChange={e => setForm(f => ({ ...f, days: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Médico</Label>
                <Input placeholder="Dr(a)." value={form.doctor_name} onChange={e => setForm(f => ({ ...f, doctor_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>CRM</Label>
                <Input value={form.crm} onChange={e => setForm(f => ({ ...f, crm: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>CID (opcional)</Label>
              <Input placeholder="Ex: J11" value={form.cid} onChange={e => setForm(f => ({ ...f, cid: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Arquivo (PDF/imagem)</Label>
              <Input ref={fileRef} type="file" accept="application/pdf,image/*"
                onChange={e => setSelectedFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
