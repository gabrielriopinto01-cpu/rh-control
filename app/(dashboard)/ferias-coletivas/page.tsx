'use client'

import { useEffect, useState, useCallback } from 'react'
import { Palmtree, Plus, Pencil, Trash2, Loader2, CalendarDays, Users, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export const dynamic = 'force-dynamic'

const STATUS_CONFIG = {
  planned:   { label: 'Planejado',  color: 'bg-blue-100 text-blue-700' },
  active:    { label: 'Em curso',   color: 'bg-green-100 text-green-700' },
  completed: { label: 'Concluído',  color: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Cancelado',  color: 'bg-red-100 text-red-600' },
}

type CollectiveVacation = {
  id: string; title: string; start_date: string; end_date: string; days: number
  scope: 'all' | 'department'; department_id?: string; notes?: string
  status: 'planned' | 'active' | 'completed' | 'cancelled'
  department?: { name: string }
}
type Dept = { id: string; name: string }

type Form = {
  title: string; start_date: string; end_date: string; scope: string
  department_id: string; notes: string; status: string
}

const blank = (): Form => ({
  title: '', start_date: '', end_date: '', scope: 'all',
  department_id: '', notes: '', status: 'planned',
})

function calcDays(s: string, e: string) {
  if (!s || !e) return 0
  const diff = (new Date(e).getTime() - new Date(s).getTime()) / 86400000
  return Math.max(0, Math.round(diff) + 1)
}

function fmtDate(d: string) { return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') }

export default function FeriasColetivas() {
  const { user } = useAuth()
  const [items,    setItems]    = useState<CollectiveVacation[]>([])
  const [depts,    setDepts]    = useState<Dept[]>([])
  const [loading,  setLoading]  = useState(true)
  const [dialog,   setDialog]   = useState(false)
  const [editing,  setEditing]  = useState<CollectiveVacation | null>(null)
  const [form,     setForm]     = useState<Form>(blank())
  const [saving,   setSaving]   = useState(false)
  const [empCount, setEmpCount] = useState<Record<string, number>>({})

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const sb = createClient()
    const [vRes, dRes, eRes] = await Promise.allSettled([
      sb.from('collective_vacations')
        .select('*, department:departments(name)')
        .eq('company_id', user.company_id)
        .order('start_date', { ascending: false }),
      sb.from('departments').select('id, name').eq('company_id', user.company_id).order('name'),
      sb.from('employees').select('id, department_id').eq('company_id', user.company_id).eq('status', 'active'),
    ])
    if (vRes.status === 'fulfilled') setItems((vRes.value.data ?? []) as CollectiveVacation[])
    if (dRes.status === 'fulfilled') setDepts((dRes.value.data ?? []) as Dept[])
    if (eRes.status === 'fulfilled') {
      const emps = (eRes.value.data ?? []) as Array<{ id: string; department_id: string | null }>
      const counts: Record<string, number> = { __total: emps.length }
      emps.forEach(e => { if (e.department_id) counts[e.department_id] = (counts[e.department_id] ?? 0) + 1 })
      setEmpCount(counts)
    }
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const days = calcDays(form.start_date, form.end_date)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.start_date || !form.end_date) { toast.error('Preencha título e datas'); return }
    if (form.scope === 'department' && !form.department_id) { toast.error('Selecione o departamento'); return }
    setSaving(true)
    const sb = createClient()
    const payload = {
      company_id: user!.company_id,
      title: form.title.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      days,
      scope: form.scope,
      department_id: form.scope === 'department' ? form.department_id : null,
      notes: form.notes || null,
      status: form.status,
      created_by: user!.id,
    }
    const { error } = editing
      ? await sb.from('collective_vacations').update(payload).eq('id', editing.id)
      : await sb.from('collective_vacations').insert(payload)
    setSaving(false)
    if (error) { toast.error('Erro ao salvar'); return }

    // Se aprovado, cria registros de férias individuais
    if (!editing && form.status !== 'cancelled') {
      const empQuery = sb.from('employees').select('id').eq('company_id', user!.company_id).eq('status', 'active')
      if (form.scope === 'department') empQuery.eq('department_id', form.department_id)
      const { data: emps } = await empQuery
      if (emps && emps.length > 0) {
        await sb.from('vacations').insert(emps.map((emp: any) => ({
          company_id: user!.company_id,
          employee_id: emp.id,
          start_date: form.start_date,
          end_date: form.end_date,
          days,
          status: 'approved',
          type: 'collective',
          approved_by_name: 'Férias Coletivas',
        })))
        toast.success(`Férias coletivas criadas e lançadas para ${emps.length} colaboradores!`)
      }
    } else {
      toast.success(editing ? 'Atualizado!' : 'Criado!')
    }
    setDialog(false); setEditing(null); load()
  }

  const remove = async (id: string) => {
    if (!confirm('Excluir este período de férias coletivas?')) return
    const { error } = await createClient().from('collective_vacations').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Excluído'); load()
  }

  if (loading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Palmtree className="h-6 w-6" /> Férias Coletivas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestão de férias coletivas — CLT Art. 139 · lança automaticamente para todos os colaboradores
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(blank()); setDialog(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Novo período
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="border border-dashed rounded-xl p-12 text-center text-muted-foreground">
          <Palmtree className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="font-medium">Nenhum período cadastrado</p>
          <p className="text-sm mt-1">Crie um período para lançar férias coletivas automaticamente</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const sc  = STATUS_CONFIG[item.status]
            const cnt = item.scope === 'all' ? empCount.__total : empCount[item.department_id ?? ''] ?? 0
            return (
              <div key={item.id} className="bg-card border rounded-xl p-5 flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-lg">{item.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.color}`}>{sc.label}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {fmtDate(item.start_date)} → {fmtDate(item.end_date)} · <strong className="text-foreground">{item.days} dias</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      {item.scope === 'all' ? <Users className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                      {item.scope === 'all' ? `Toda empresa (${cnt} colab.)` : `${(item.department as any)?.name ?? '—'} (${cnt} colab.)`}
                    </span>
                  </div>
                  {item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => {
                    setEditing(item)
                    setForm({
                      title: item.title, start_date: item.start_date, end_date: item.end_date,
                      scope: item.scope, department_id: item.department_id ?? '', notes: item.notes ?? '',
                      status: item.status,
                    })
                    setDialog(true)
                  }} className="p-2 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(item.id)}
                    className="p-2 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Aviso legal */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 space-y-1">
        <p className="font-medium">CLT Art. 139 — Obrigações legais</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs">
          <li>O empregador deve comunicar ao MTE com 15 dias de antecedência (eSocial S-2230)</li>
          <li>Comunicar os sindicatos das categorias profissionais com antecedência mínima de 15 dias</li>
          <li>Afixar avisos nos locais de trabalho</li>
          <li>Período máximo: 30 dias corridos de uma só vez ou 2 períodos de até 10 dias</li>
        </ul>
      </div>

      <Dialog open={dialog} onOpenChange={v => { setDialog(v); if (!v) setEditing(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar período' : 'Novo período de férias coletivas'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input placeholder="Ex: Recesso de Fim de Ano 2026" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Início *</Label>
                <Input type="date" value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Fim *</Label>
                <Input type="date" value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            {days > 0 && (
              <p className="text-sm text-indigo-600 font-medium">
                {days} dia{days !== 1 ? 's' : ''} corrido{days !== 1 ? 's' : ''}
                {days > 30 && <span className="text-red-600"> — atenção: máximo permitido é 30 dias</span>}
              </p>
            )}
            <div className="space-y-1.5">
              <Label>Abrangência</Label>
              <Select value={form.scope} onValueChange={v => setForm(f => ({ ...f, scope: v ?? 'all' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda a empresa</SelectItem>
                  <SelectItem value="department">Departamento específico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.scope === 'department' && (
              <div className="space-y-1.5">
                <Label>Departamento *</Label>
                <Select value={form.department_id} onValueChange={v => setForm(f => ({ ...f, department_id: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {depts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v ?? 'planned' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea rows={2} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            {!editing && (
              <p className="text-xs text-muted-foreground bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
                Ao criar, os registros de férias serão lançados automaticamente para os colaboradores incluídos.
              </p>
            )}
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editing ? 'Salvar' : 'Criar e lançar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
