'use client'

import { useEffect, useState, useCallback } from 'react'
import { UserMinus, Plus, Trash2, ExternalLink, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatDate } from '@/lib/utils'
import type { Leave, LeaveType, Employee } from '@/types/database'

export const dynamic = 'force-dynamic'

export const LEAVE_LABELS: Record<LeaveType, string> = {
  inss:          'INSS',
  maternidade:   'Licença maternidade',
  paternidade:   'Licença paternidade',
  obito:         'Licença óbito',
  casamento:     'Licença casamento',
  acidente:      'Acidente de trabalho',
  suspensao:     'Suspensão',
  falta_abonada: 'Falta abonada',
  falta:         'Falta',
  advertencia:   'Advertência',
  outro:         'Outro',
}

const LEAVE_COLORS: Record<LeaveType, string> = {
  inss:          'bg-blue-100 text-blue-700',
  maternidade:   'bg-pink-100 text-pink-700',
  paternidade:   'bg-cyan-100 text-cyan-700',
  obito:         'bg-gray-200 text-gray-700',
  casamento:     'bg-rose-100 text-rose-700',
  acidente:      'bg-red-100 text-red-700',
  suspensao:     'bg-orange-100 text-orange-700',
  falta_abonada: 'bg-green-100 text-green-700',
  falta:         'bg-red-100 text-red-700',
  advertencia:   'bg-amber-100 text-amber-700',
  outro:         'bg-gray-100 text-gray-700',
}

type FormState = {
  employee_id: string; type: LeaveType; start_date: string; end_date: string; reason: string; notes: string
}

export default function AfastamentosPage() {
  const { user } = useAuth()
  const [leaves,    setLeaves]    = useState<Leave[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [filterType,setFilterType]= useState<LeaveType | 'all'>('all')
  const [dialog,    setDialog]    = useState(false)
  const [saving,    setSaving]    = useState(false)

  const blank = (): FormState => ({
    employee_id: '', type: 'inss', start_date: new Date().toISOString().slice(0, 10),
    end_date: '', reason: '', notes: '',
  })
  const [form, setForm] = useState<FormState>(blank)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const supabase = createClient()
    const [lRes, eRes] = await Promise.all([
      supabase.from('leaves').select('*').eq('company_id', user.company_id).order('start_date', { ascending: false }),
      supabase.from('employees').select('id, full_name').eq('company_id', user.company_id).eq('status', 'active').order('full_name'),
    ])
    setLeaves((lRes.data as Leave[]) ?? [])
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
    const { error } = await supabase.from('leaves').insert({
      company_id: user.company_id, employee_id: form.employee_id, type: form.type,
      start_date: form.start_date, end_date: form.end_date || null,
      reason: form.reason || null, notes: form.notes || null, created_by: user.id,
    })
    setSaving(false)
    if (error) { toast.error('Erro ao salvar afastamento'); return }
    toast.success('Afastamento registrado!')
    setForm(blank()); setDialog(false)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este afastamento?')) return
    const supabase = createClient()
    const { error } = await supabase.from('leaves').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Afastamento excluído')
    load()
  }

  const filtered = leaves.filter(l => {
    if (filterType !== 'all' && l.type !== filterType) return false
    if (search && !empName(l.employee_id).toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Afastamentos e Ocorrências</h1>
          <p className="text-gray-500 mt-1">Licenças, suspensões, advertências e ocorrências</p>
        </div>
        <Button onClick={() => { setForm(blank()); setDialog(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Novo registro
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input className="pl-9" placeholder="Buscar colaborador..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterType} onValueChange={(v) => setFilterType((v ?? 'all') as LeaveType | 'all')}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(LEAVE_LABELS).map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <UserMinus className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Nenhum afastamento registrado</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Colaborador','Tipo','Início','Fim','Motivo',''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{empName(l.employee_id)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${LEAVE_COLORS[l.type]}`}>
                      {LEAVE_LABELS[l.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(l.start_date)}</td>
                  <td className="px-4 py-3 text-gray-600">{l.end_date ? formatDate(l.end_date) : '—'}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{l.reason ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(l.id)} className="text-red-400 hover:text-red-600">
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
          <DialogHeader><DialogTitle className="flex items-center gap-2"><UserMinus className="h-4 w-4" /> Novo afastamento</DialogTitle></DialogHeader>
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
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: (v ?? 'outro') as LeaveType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAVE_LABELS).map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Início *</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Fim</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
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
