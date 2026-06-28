'use client'

import { useEffect, useState, useCallback } from 'react'
import { BookOpen, Plus, Pencil, Trash2, CheckCircle, Circle, Clock, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export const dynamic = 'force-dynamic'

const CATEGORIES: Record<string, { label: string; color: string }> = {
  skill:     { label: 'Habilidade Técnica', color: 'bg-blue-100 text-blue-700' },
  behavior:  { label: 'Comportamento',      color: 'bg-purple-100 text-purple-700' },
  knowledge: { label: 'Conhecimento',       color: 'bg-green-100 text-green-700' },
  career:    { label: 'Carreira',           color: 'bg-orange-100 text-orange-700' },
}

const STATUS_PDI: Record<string, { label: string; Icon: any; color: string }> = {
  pending:     { label: 'Pendente',     Icon: Circle,       color: 'text-muted-foreground' },
  in_progress: { label: 'Em andamento', Icon: Clock,        color: 'text-blue-500' },
  done:        { label: 'Concluído',    Icon: CheckCircle,  color: 'text-green-500' },
  cancelled:   { label: 'Cancelado',    Icon: XCircle,      color: 'text-red-400' },
}

type PDIItem = {
  id: string; employee_id: string; title: string; description?: string
  category: string; target_date?: string; status: string
  employee?: { full_name: string }
}

type Form = { employee_id: string; title: string; description: string; category: string; target_date: string }

export default function PdiPage() {
  const { user } = useAuth()
  const [items,     setItems]     = useState<PDIItem[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [dialog,    setDialog]    = useState(false)
  const [editing,   setEditing]   = useState<PDIItem | null>(null)
  const [form,      setForm]      = useState<Form>({ employee_id: '', title: '', description: '', category: 'skill', target_date: '' })
  const [filterEmp, setFilterEmp] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterSt,  setFilterSt]  = useState('')

  const supabase = isSupabaseConfigured() ? createClient() : null

  const load = useCallback(async () => {
    if (!supabase || !user) { setLoading(false); return }
    setLoading(true)
    const [pdiRes, empRes] = await Promise.all([
      supabase.from('pdi_items').select('*, employee:employees(full_name)').eq('company_id', user.company_id).order('target_date', { ascending: true }),
      supabase.from('employees').select('id, full_name').eq('company_id', user.company_id).eq('status', 'active').order('full_name'),
    ])
    setItems(pdiRes.data ?? [])
    setEmployees(empRes.data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm({ employee_id: employees[0]?.id ?? '', title: '', description: '', category: 'skill', target_date: '' })
    setDialog(true)
  }
  function openEdit(item: PDIItem) {
    setEditing(item)
    setForm({ employee_id: item.employee_id, title: item.title, description: item.description ?? '', category: item.category, target_date: item.target_date ?? '' })
    setDialog(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !user) return
    if (!form.title || !form.employee_id) { toast.error('Preencha título e colaborador'); return }

    const payload = { title: form.title, description: form.description || null, category: form.category, target_date: form.target_date || null, updated_at: new Date().toISOString() }

    if (editing) {
      const { error } = await supabase.from('pdi_items').update(payload).eq('id', editing.id)
      if (error) { toast.error('Erro ao atualizar'); return }
      toast.success('PDI atualizado!')
    } else {
      const { error } = await supabase.from('pdi_items').insert({ ...payload, company_id: user.company_id, employee_id: form.employee_id, created_by: user.id, status: 'pending' })
      if (error) { toast.error('Erro ao criar'); return }
      toast.success('Item de PDI criado!')
    }
    setDialog(false); load()
  }

  async function updateStatus(id: string, status: string) {
    if (!supabase) return
    await supabase.from('pdi_items').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  async function handleDelete(id: string) {
    if (!supabase || !confirm('Excluir este item do PDI?')) return
    await supabase.from('pdi_items').delete().eq('id', id)
    toast.success('Item excluído'); load()
  }

  const filtered = items.filter(i =>
    (!filterEmp || i.employee_id === filterEmp) &&
    (!filterCat || i.category === filterCat) &&
    (!filterSt  || i.status === filterSt)
  )

  const stats = {
    total:       items.length,
    in_progress: items.filter(i => i.status === 'in_progress').length,
    done:        items.filter(i => i.status === 'done').length,
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="h-6 w-6" /> PDI — Plano de Desenvolvimento</h1>
          <p className="text-muted-foreground text-sm mt-1">Acompanhe o desenvolvimento individual de cada colaborador</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Novo item</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-muted/40 rounded-xl p-4">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-sm text-muted-foreground">Total</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-2xl font-bold text-blue-700">{stats.in_progress}</p>
          <p className="text-sm text-blue-600">Em andamento</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <p className="text-2xl font-bold text-green-700">{stats.done}</p>
          <p className="text-sm text-green-600">Concluídos</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm bg-background">
          <option value="">Todos os colaboradores</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm bg-background">
          <option value="">Todas as categorias</option>
          {Object.entries(CATEGORIES).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <select value={filterSt} onChange={e => setFilterSt(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm bg-background">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_PDI).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center border border-dashed rounded-xl text-muted-foreground">
          <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum item de PDI encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const cat = CATEGORIES[item.category] ?? CATEGORIES.skill!
            const st  = STATUS_PDI[item.status]  ?? STATUS_PDI.pending!
            const overdue = item.target_date && item.status !== 'done' && new Date(item.target_date) < new Date()
            return (
              <div key={item.id} className="bg-card border rounded-xl p-4 flex items-start gap-3">
                <st.Icon className={`h-5 w-5 mt-0.5 shrink-0 ${st.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{item.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${cat.color}`}>{cat.label}</span>
                    {overdue && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Atrasado</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.employee?.full_name}
                    {item.target_date && ` · prazo: ${new Date(item.target_date + 'T00:00:00').toLocaleDateString('pt-BR')}`}
                  </p>
                  {item.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{item.description}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <select
                    value={item.status}
                    onChange={e => updateStatus(item.id, e.target.value)}
                    className="text-xs border rounded px-2 py-1 bg-background"
                  >
                    {Object.entries(STATUS_PDI).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
                  </select>
                  <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar item' : 'Novo item de PDI'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {!editing && (
              <div className="space-y-1.5">
                <Label>Colaborador *</Label>
                <select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                  <option value="">Selecione...</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input placeholder="Ex: Aprender Power BI" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                  {Object.entries(CATEGORIES).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Prazo</Label>
                <Input type="date" value={form.target_date} onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea rows={2} placeholder="Como será desenvolvido, recursos necessários..." value={form.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm(f => ({ ...f, description: e.target.value }))} />
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
