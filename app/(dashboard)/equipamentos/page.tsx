'use client'

import { useEffect, useState, useCallback } from 'react'
import { Laptop, Plus, Trash2, Loader2, Search, PackageCheck, PackageX, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatDate } from '@/lib/utils'
import type { Equipment, EquipmentCategory, EquipmentStatus, Employee } from '@/types/database'

export const dynamic = 'force-dynamic'

const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  notebook: 'Notebook', celular: 'Celular', tablet: 'Tablet', ferramenta: 'Ferramenta',
  uniforme: 'Uniforme', veiculo: 'Veículo', chave: 'Chave', cartao: 'Cartão corporativo',
  cracha: 'Crachá', outro: 'Outro',
}

const STATUS_META: Record<EquipmentStatus, { label: string; color: string }> = {
  disponivel: { label: 'Disponível', color: 'bg-gray-100 text-gray-700' },
  entregue:   { label: 'Entregue',   color: 'bg-blue-100 text-blue-700' },
  devolvido:  { label: 'Devolvido',  color: 'bg-green-100 text-green-700' },
  manutencao: { label: 'Manutenção', color: 'bg-amber-100 text-amber-700' },
  baixado:    { label: 'Baixado',    color: 'bg-red-100 text-red-700' },
}

type FormState = {
  name: string; category: EquipmentCategory; identifier: string
  employee_id: string; status: EquipmentStatus; delivered_at: string; returned_at: string; notes: string
}

export default function EquipamentosPage() {
  const { user } = useAuth()
  const [items,     setItems]     = useState<Equipment[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [filterStatus, setFilterStatus] = useState<EquipmentStatus | 'all'>('all')
  const [dialog,    setDialog]    = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const blank = (): FormState => ({
    name: '', category: 'notebook', identifier: '', employee_id: '',
    status: 'disponivel', delivered_at: '', returned_at: '', notes: '',
  })
  const [form, setForm] = useState<FormState>(blank)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const supabase = createClient()
    const [iRes, eRes] = await Promise.all([
      supabase.from('equipment').select('*').eq('company_id', user.company_id).order('created_at', { ascending: false }),
      supabase.from('employees').select('id, full_name').eq('company_id', user.company_id).eq('status', 'active').order('full_name'),
    ])
    setItems((iRes.data as Equipment[]) ?? [])
    setEmployees((eRes.data as Employee[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const empName = (id: string | null) => id ? (employees.find(e => e.id === id)?.full_name ?? '—') : '—'

  const openCreate = () => { setEditingId(null); setForm(blank()); setDialog(true) }
  const openEdit = (item: Equipment) => {
    setEditingId(item.id)
    setForm({
      name: item.name, category: item.category, identifier: item.identifier ?? '',
      employee_id: item.employee_id ?? '', status: item.status,
      delivered_at: item.delivered_at ?? '', returned_at: item.returned_at ?? '', notes: item.notes ?? '',
    })
    setDialog(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured() || !user) return
    if (!form.name) { toast.error('Informe o nome do equipamento'); return }
    setSaving(true)
    const supabase = createClient()
    const payload = {
      company_id: user.company_id, name: form.name, category: form.category,
      identifier: form.identifier || null, employee_id: form.employee_id || null,
      status: form.status, delivered_at: form.delivered_at || null, returned_at: form.returned_at || null,
      notes: form.notes || null,
    }
    const { error } = editingId
      ? await supabase.from('equipment').update(payload).eq('id', editingId)
      : await supabase.from('equipment').insert({ ...payload, created_by: user.id })
    setSaving(false)
    if (error) { toast.error('Erro ao salvar equipamento'); return }
    toast.success(editingId ? 'Equipamento atualizado!' : 'Equipamento cadastrado!')
    setDialog(false); setEditingId(null); setForm(blank())
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este equipamento?')) return
    const supabase = createClient()
    const { error } = await supabase.from('equipment').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Equipamento excluído')
    load()
  }

  const filtered = items.filter(i => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      if (!i.name.toLowerCase().includes(q) &&
          !(i.identifier ?? '').toLowerCase().includes(q) &&
          !empName(i.employee_id).toLowerCase().includes(q)) return false
    }
    return true
  })

  const stats = [
    { label: 'Total',     value: items.length,                                       Icon: Laptop,       color: 'text-blue-600',  bg: 'bg-blue-50' },
    { label: 'Entregues', value: items.filter(i => i.status === 'entregue').length,   Icon: PackageCheck, color: 'text-blue-600',  bg: 'bg-blue-50' },
    { label: 'Devolvidos',value: items.filter(i => i.status === 'devolvido').length,  Icon: PackageX,     color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Manutenção',value: items.filter(i => i.status === 'manutencao').length, Icon: Wrench,       color: 'text-amber-600', bg: 'bg-amber-50' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipamentos</h1>
          <p className="text-gray-500 mt-1">Ativos vinculados aos colaboradores</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo equipamento</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(({ label, value, Icon, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4 flex items-center gap-3`}>
            <Icon className={`h-5 w-5 ${color} shrink-0`} />
            <div><p className="text-xl font-bold text-gray-900">{value}</p><p className="text-xs text-gray-500">{label}</p></div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input className="pl-9" placeholder="Buscar por nome, série ou colaborador..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus((v ?? 'all') as EquipmentStatus | 'all')}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_META).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Laptop className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Nenhum equipamento cadastrado</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Equipamento','Categoria','Identificação','Colaborador','Status','Entrega','',''].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(item => {
                const s = STATUS_META[item.status]
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-3 text-gray-600">{CATEGORY_LABELS[item.category]}</td>
                    <td className="px-4 py-3 text-gray-500">{item.identifier ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{empName(item.employee_id)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.delivered_at ? formatDate(item.delivered_at) : '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(item)} className="text-xs px-2 py-1 rounded hover:bg-gray-100 text-gray-500">Editar</button>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Laptop className="h-4 w-4" /> {editingId ? 'Editar' : 'Novo'} equipamento</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="Ex: Notebook Dell Latitude" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: (v ?? 'outro') as EquipmentCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Identificação</Label>
                <Input placeholder="Série/patrimônio" value={form.identifier} onChange={e => setForm(f => ({ ...f, identifier: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Colaborador</Label>
              <Select value={form.employee_id || 'none'} onValueChange={(v) => setForm(f => ({ ...f, employee_id: v === 'none' ? '' : (v ?? '') }))}>
                <SelectTrigger><SelectValue placeholder="Não atribuído" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não atribuído</SelectItem>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5 col-span-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: (v ?? 'disponivel') as EquipmentStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_META).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Entrega</Label>
                <Input type="date" value={form.delivered_at} onChange={e => setForm(f => ({ ...f, delivered_at: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Devolução</Label>
                <Input type="date" value={form.returned_at} onChange={e => setForm(f => ({ ...f, returned_at: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
