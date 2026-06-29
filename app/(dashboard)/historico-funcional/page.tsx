'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  History, Plus, Pencil, Trash2, Loader2, Search,
  TrendingUp, TrendingDown, ArrowRightLeft, DollarSign,
  Briefcase, FileText, Award, AlertTriangle, Star,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export const dynamic = 'force-dynamic'

const EVENT_TYPES: Record<string, { label: string; Icon: React.ComponentType<{ className?: string }>; color: string }> = {
  admission:       { label: 'Admissão',           Icon: Star,           color: 'text-green-600 bg-green-50' },
  promotion:       { label: 'Promoção',            Icon: TrendingUp,     color: 'text-blue-600 bg-blue-50' },
  demotion:        { label: 'Rebaixamento',        Icon: TrendingDown,   color: 'text-orange-600 bg-orange-50' },
  transfer:        { label: 'Transferência',       Icon: ArrowRightLeft, color: 'text-purple-600 bg-purple-50' },
  salary_change:   { label: 'Alteração Salarial',  Icon: DollarSign,     color: 'text-emerald-600 bg-emerald-50' },
  position_change: { label: 'Mudança de Cargo',    Icon: Briefcase,      color: 'text-indigo-600 bg-indigo-50' },
  contract_change: { label: 'Alt. Contratual',     Icon: FileText,       color: 'text-cyan-600 bg-cyan-50' },
  warning:         { label: 'Advertência',         Icon: AlertTriangle,  color: 'text-red-600 bg-red-50' },
  commendation:    { label: 'Elogio / Distinção',  Icon: Award,          color: 'text-yellow-600 bg-yellow-50' },
  other:           { label: 'Outro',               Icon: History,        color: 'text-gray-600 bg-gray-50' },
}

type FuncEvent = {
  id: string; employee_id: string; event_type: string; event_date: string
  title: string; description?: string
  from_position?: string; to_position?: string
  from_department?: string; to_department?: string
  from_salary?: number; to_salary?: number
  employee?: { full_name: string }
}
type Employee = { id: string; full_name: string }

type Form = {
  employee_id: string; event_type: string; event_date: string; title: string
  description: string; from_position: string; to_position: string
  from_department: string; to_department: string
  from_salary: string; to_salary: string
}

const blank = (): Form => ({
  employee_id: '', event_type: 'other',
  event_date: new Date().toISOString().slice(0, 10),
  title: '', description: '',
  from_position: '', to_position: '',
  from_department: '', to_department: '',
  from_salary: '', to_salary: '',
})

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

function fmtMoney(v?: number | null) {
  if (v == null) return null
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const WITH_CHANGE = ['promotion','demotion','transfer','salary_change','position_change','contract_change']

export default function HistoricoFuncionalPage() {
  const { user }  = useAuth()
  const [events,    setEvents]    = useState<FuncEvent[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [filterEmp, setFilterEmp] = useState('all')
  const [filterType,setFilterType]= useState('all')
  const [dialog,    setDialog]    = useState(false)
  const [editing,   setEditing]   = useState<FuncEvent | null>(null)
  const [form,      setForm]      = useState<Form>(blank())
  const [saving,    setSaving]    = useState(false)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const sb = createClient()
    const [evRes, emRes] = await Promise.allSettled([
      sb.from('functional_history')
        .select('*, employee:employees(full_name)')
        .eq('company_id', user.company_id)
        .order('event_date', { ascending: false }),
      sb.from('employees').select('id, full_name').eq('company_id', user.company_id).order('full_name'),
    ])
    if (evRes.status === 'fulfilled') setEvents((evRes.value.data ?? []) as FuncEvent[])
    if (emRes.status === 'fulfilled') setEmployees((emRes.value.data ?? []) as Employee[])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.employee_id) { toast.error('Selecione o colaborador'); return }
    if (!form.title.trim()) { toast.error('Informe o título do evento'); return }
    setSaving(true)
    const sb = createClient()
    const payload = {
      company_id:    user!.company_id,
      employee_id:   form.employee_id,
      event_type:    form.event_type,
      event_date:    form.event_date,
      title:         form.title,
      description:   form.description || null,
      from_position: form.from_position || null,
      to_position:   form.to_position   || null,
      from_department: form.from_department || null,
      to_department:   form.to_department   || null,
      from_salary: form.from_salary ? parseFloat(form.from_salary) : null,
      to_salary:   form.to_salary   ? parseFloat(form.to_salary)   : null,
      created_by: user!.id,
    }
    const { error } = editing
      ? await sb.from('functional_history').update(payload).eq('id', editing.id)
      : await sb.from('functional_history').insert(payload)
    setSaving(false)
    if (error) { toast.error('Erro ao salvar'); return }
    toast.success(editing ? 'Evento atualizado' : 'Evento registrado')
    setDialog(false); setEditing(null); load()
  }

  const remove = async (id: string) => {
    if (!confirm('Excluir este evento?')) return
    const { error } = await createClient().from('functional_history').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Excluído'); load()
  }

  const openNew = () => { setEditing(null); setForm(blank()); setDialog(true) }
  const openEdit = (ev: FuncEvent) => {
    setEditing(ev)
    setForm({
      employee_id: ev.employee_id, event_type: ev.event_type,
      event_date: ev.event_date, title: ev.title,
      description: ev.description ?? '',
      from_position: ev.from_position ?? '', to_position: ev.to_position ?? '',
      from_department: ev.from_department ?? '', to_department: ev.to_department ?? '',
      from_salary: ev.from_salary?.toString() ?? '', to_salary: ev.to_salary?.toString() ?? '',
    })
    setDialog(true)
  }

  const filtered = events.filter(ev => {
    if (filterEmp !== 'all' && ev.employee_id !== filterEmp) return false
    if (filterType !== 'all' && ev.event_type !== filterType) return false
    if (search && !(ev.employee as any)?.full_name?.toLowerCase().includes(search.toLowerCase()) &&
        !ev.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Group by employee when no employee filter
  const grouped = filterEmp === 'all'
    ? filtered.reduce<Record<string, FuncEvent[]>>((acc, ev) => {
        const name = (ev.employee as any)?.full_name ?? ev.employee_id
        if (!acc[name]) acc[name] = []
        acc[name]!.push(ev)
        return acc
      }, {})
    : { [(employees.find(e => e.id === filterEmp)?.full_name ?? 'Colaborador')]: filtered }

  const showChange = WITH_CHANGE.includes(form.event_type)

  if (loading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6" /> Histórico Funcional
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Promoções, transferências, mudanças salariais e eventos da carreira
          </p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Registrar Evento</Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 w-56" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterEmp} onValueChange={v => setFilterEmp(v ?? 'all')}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Todos colaboradores" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os colaboradores</SelectItem>
            {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={v => setFilterType(v ?? 'all')}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tipo de evento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(EVENT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Timeline por colaborador */}
      {Object.keys(grouped).length === 0 && (
        <div className="bg-card border rounded-xl p-10 text-center text-muted-foreground text-sm">
          Nenhum evento encontrado
        </div>
      )}

      {Object.entries(grouped).map(([name, evs]) => (
        <div key={name} className="bg-card border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b bg-muted/30 font-semibold text-sm">{name}</div>
          <div className="px-5 py-4 space-y-0">
            {evs.map((ev, idx) => {
              const meta = EVENT_TYPES[ev.event_type] ?? EVENT_TYPES.other!
              const Icon = meta.Icon
              const isLast = idx === evs.length - 1
              return (
                <div key={ev.id} className="flex gap-4 group">
                  {/* Ícone + linha */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${meta.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    {!isLast && <div className="w-0.5 flex-1 bg-border my-1" />}
                  </div>
                  {/* Conteúdo */}
                  <div className={`flex-1 pb-5 ${isLast ? 'pb-2' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{ev.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{meta.label} · {fmtDate(ev.event_date)}</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(ev)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => remove(ev.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {/* Mudanças de/para */}
                    {(ev.from_position || ev.to_position || ev.from_department || ev.to_department || ev.from_salary != null || ev.to_salary != null) && (
                      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                        {(ev.from_position || ev.to_position) && (
                          <span>Cargo: <span className="line-through text-gray-400">{ev.from_position ?? '—'}</span>
                            {' → '}<span className="text-foreground font-medium">{ev.to_position ?? '—'}</span>
                          </span>
                        )}
                        {(ev.from_department || ev.to_department) && (
                          <span>Dept: <span className="line-through text-gray-400">{ev.from_department ?? '—'}</span>
                            {' → '}<span className="text-foreground font-medium">{ev.to_department ?? '—'}</span>
                          </span>
                        )}
                        {(ev.from_salary != null || ev.to_salary != null) && (
                          <span>Salário: <span className="line-through text-gray-400">{fmtMoney(ev.from_salary) ?? '—'}</span>
                            {' → '}<span className="text-foreground font-medium">{fmtMoney(ev.to_salary) ?? '—'}</span>
                          </span>
                        )}
                      </div>
                    )}
                    {ev.description && <p className="mt-1.5 text-xs text-muted-foreground italic">{ev.description}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Dialog */}
      <Dialog open={dialog} onOpenChange={v => { setDialog(v); if (!v) setEditing(null) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Evento' : 'Registrar Evento'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Colaborador *</Label>
              <Select value={form.employee_id} onValueChange={v => setForm(f => ({ ...f, employee_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo de evento *</Label>
                <Select value={form.event_type} onValueChange={v => setForm(f => ({ ...f, event_type: v ?? 'other' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(EVENT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Data do evento *</Label>
                <Input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input placeholder="Ex: Promoção para Coordenador de TI" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            {showChange && (
              <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Alteração (De → Para)</p>
                {['position_change','promotion','demotion','other','admission','commendation','warning'].every(t => t !== form.event_type) || ['position_change','promotion','demotion','transfer'].includes(form.event_type) ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Cargo anterior</Label>
                      <Input placeholder="Cargo de origem" value={form.from_position} onChange={e => setForm(f => ({ ...f, from_position: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Cargo novo</Label>
                      <Input placeholder="Cargo destino" value={form.to_position} onChange={e => setForm(f => ({ ...f, to_position: e.target.value }))} />
                    </div>
                  </div>
                ) : null}
                {['transfer'].includes(form.event_type) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Depto anterior</Label>
                      <Input value={form.from_department} onChange={e => setForm(f => ({ ...f, from_department: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Depto novo</Label>
                      <Input value={form.to_department} onChange={e => setForm(f => ({ ...f, to_department: e.target.value }))} />
                    </div>
                  </div>
                )}
                {['salary_change','promotion','demotion','contract_change'].includes(form.event_type) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Salário anterior (R$)</Label>
                      <Input type="number" step="0.01" value={form.from_salary} onChange={e => setForm(f => ({ ...f, from_salary: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Salário novo (R$)</Label>
                      <Input type="number" step="0.01" value={form.to_salary} onChange={e => setForm(f => ({ ...f, to_salary: e.target.value }))} />
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editing ? 'Salvar' : 'Registrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
