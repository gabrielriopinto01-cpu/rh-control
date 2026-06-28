'use client'

import { useEffect, useState, useCallback } from 'react'
import { ClipboardList, Plus, Trash2, Loader2, UserPlus, UserMinus, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import type { EmployeeChecklist, ChecklistItem, Employee } from '@/types/database'

export const dynamic = 'force-dynamic'

const DEFAULT_ITEMS: Record<'onboarding' | 'offboarding', string[]> = {
  onboarding: [
    'Documentos recebidos', 'Contrato assinado', 'E-mail corporativo criado',
    'Uniforme entregue', 'Equipamentos entregues', 'Treinamentos iniciais concluídos',
    'Acesso aos sistemas liberado',
  ],
  offboarding: [
    'Equipamentos devolvidos', 'Acessos encerrados', 'E-mail desativado',
    'Documentação final entregue', 'Termo de rescisão assinado', 'Crachá revogado',
  ],
}

const TYPE_META = {
  onboarding:  { label: 'Admissão',    Icon: UserPlus,  color: 'text-green-600', chip: 'bg-green-100 text-green-700' },
  offboarding: { label: 'Desligamento', Icon: UserMinus, color: 'text-red-600',   chip: 'bg-red-100 text-red-700' },
}

export default function ChecklistsPage() {
  const { user } = useAuth()
  const [lists,     setLists]     = useState<EmployeeChecklist[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading,   setLoading]   = useState(true)
  const [dialog,    setDialog]    = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [newType,   setNewType]   = useState<'onboarding' | 'offboarding'>('onboarding')
  const [newEmp,    setNewEmp]    = useState('')

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const supabase = createClient()
    const [lRes, eRes] = await Promise.all([
      supabase.from('employee_checklists').select('*').eq('company_id', user.company_id).order('created_at', { ascending: false }),
      supabase.from('employees').select('id, full_name').eq('company_id', user.company_id).order('full_name'),
    ])
    setLists((lRes.data as EmployeeChecklist[]) ?? [])
    setEmployees((eRes.data as Employee[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const empName = (id: string) => employees.find(e => e.id === id)?.full_name ?? '—'

  const handleCreate = async () => {
    if (!isSupabaseConfigured() || !user) return
    if (!newEmp) { toast.error('Selecione o colaborador'); return }
    setSaving(true)
    const items: ChecklistItem[] = DEFAULT_ITEMS[newType].map(label => ({ label, done: false }))
    const supabase = createClient()
    const { error } = await supabase.from('employee_checklists').insert({
      company_id: user.company_id, employee_id: newEmp, type: newType, items, created_by: user.id,
    })
    setSaving(false)
    if (error) { toast.error('Erro ao criar checklist'); return }
    toast.success('Checklist criado!')
    setDialog(false); setNewEmp('')
    load()
  }

  const toggleItem = async (list: EmployeeChecklist, idx: number) => {
    const items = list.items.map((it, i) => i === idx ? { ...it, done: !it.done } : it)
    setLists(ls => ls.map(l => l.id === list.id ? { ...l, items } : l))
    const supabase = createClient()
    const { error } = await supabase.from('employee_checklists').update({ items }).eq('id', list.id)
    if (error) { toast.error('Erro ao atualizar'); load() }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este checklist?')) return
    const supabase = createClient()
    const { error } = await supabase.from('employee_checklists').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Checklist excluído'); load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admissão & Desligamento</h1>
          <p className="text-gray-500 mt-1">Checklists de onboarding e offboarding por colaborador</p>
        </div>
        <Button onClick={() => setDialog(true)}><Plus className="h-4 w-4 mr-2" /> Novo checklist</Button>
      </div>

      {loading ? (
        <div className="p-10 text-center text-gray-400">Carregando...</div>
      ) : lists.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ClipboardList className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Nenhum checklist criado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {lists.map(list => {
            const meta = TYPE_META[list.type]
            const done = list.items.filter(i => i.done).length
            const pct  = list.items.length ? Math.round((done / list.items.length) * 100) : 0
            return (
              <div key={list.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <meta.Icon className={`h-5 w-5 ${meta.color}`} />
                    <div>
                      <p className="font-semibold text-gray-900">{empName(list.employee_id)}</p>
                      <span className={`inline-flex text-xs px-2 py-0.5 rounded-full ${meta.chip}`}>{meta.label}</span>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(list.id)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-medium text-gray-500">{done}/{list.items.length}</span>
                </div>

                <div className="mt-4 space-y-1.5">
                  {list.items.map((it, idx) => (
                    <button key={idx} onClick={() => toggleItem(list, idx)}
                      className="w-full flex items-center gap-2.5 text-left py-1 group">
                      <span className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                        it.done ? 'bg-green-500 border-green-500' : 'border-gray-300 group-hover:border-gray-400'}`}>
                        {it.done && <CheckCircle2 className="h-4 w-4 text-white" />}
                      </span>
                      <span className={`text-sm ${it.done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{it.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Novo checklist</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['onboarding', 'offboarding'] as const).map(t => {
                  const m = TYPE_META[t]
                  return (
                    <button key={t} onClick={() => setNewType(t)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-colors ${
                        newType === t ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <m.Icon className={`h-5 w-5 ${m.color}`} />
                      <span className="text-sm">{m.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Colaborador</Label>
              <Select value={newEmp} onValueChange={(v) => setNewEmp(v ?? '')}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
              Serão criados os itens padrão de {TYPE_META[newType].label.toLowerCase()}. Você pode marcá-los conforme conclui.
            </p>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Criar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
