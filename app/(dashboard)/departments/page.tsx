'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Building2, Users, ChevronRight, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { DepartmentForm } from '@/components/modules/departments/department-form'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import type { Department, Employee, Position } from '@/types/database'
import type { DepartmentFormData } from '@/lib/validations/department'
import { positionSchema, type PositionFormInput, type PositionFormData } from '@/lib/validations/department'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { formatCurrency, nn } from '@/lib/utils'

export default function DepartmentsPage() {
  const { user } = useAuth()
  const [departments, setDepartments] = useState<Department[]>([])
  const [employees, setEmployees]     = useState<Employee[]>([])
  const [positions, setPositions]     = useState<Position[]>([])
  const [loading, setLoading]         = useState(true)

  const [deptDialog, setDeptDialog]   = useState(false)
  const [posDialog, setPosDialog]     = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [editingPos, setEditingPos]   = useState<Position | null>(null)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const supabase = createClient()
    const [d, e, p] = await Promise.all([
      supabase.from('departments').select('*').eq('company_id', user.company_id).order('name'),
      supabase.from('employees').select('id, full_name').eq('company_id', user.company_id).eq('status', 'active').order('full_name'),
      supabase.from('positions').select('*').eq('company_id', user.company_id).order('title'),
    ])
    setDepartments(d.data ?? [])
    setEmployees(e.data as Employee[] ?? [])
    setPositions(p.data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // ─── Departamentos ───────────────────────────────────────────────
  const handleDeptSubmit = async (data: DepartmentFormData) => {
    if (!isSupabaseConfigured() || !user) return
    const supabase = createClient()
    const payload = {
      company_id:  user.company_id,
      name:        data.name,
      parent_id:   data.parent_id || null,
      manager_id:  data.manager_id || null,
    }
    if (editingDept) {
      const { error } = await supabase.from('departments').update(payload).eq('id', editingDept.id)
      if (error) { toast.error('Erro ao atualizar'); return }
      toast.success('Departamento atualizado!')
    } else {
      const { error } = await supabase.from('departments').insert(payload)
      if (error) { toast.error('Erro ao criar'); return }
      toast.success('Departamento criado!')
    }
    setDeptDialog(false)
    setEditingDept(null)
    load()
  }

  const handleDeptDelete = async (id: string) => {
    if (!confirm('Excluir este departamento?')) return
    const supabase = createClient()
    const { error } = await supabase.from('departments').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Departamento excluído')
    load()
  }

  // ─── Cargos ──────────────────────────────────────────────────────
  const posForm = useForm<PositionFormInput, unknown, PositionFormData>({ resolver: zodResolver(positionSchema) })

  const openPosDialog = (pos?: Position) => {
    setEditingPos(pos ?? null)
    posForm.reset(pos ? {
      title:         pos.title,
      department_id: pos.department_id ?? '',
      salary_min:    pos.salary_min ?? undefined,
      salary_max:    pos.salary_max ?? undefined,
      cbo_code:      pos.cbo_code ?? '',
    } : {})
    setPosDialog(true)
  }

  const handlePosSubmit = async (data: PositionFormData) => {
    if (!isSupabaseConfigured() || !user) return
    const supabase = createClient()
    const payload = {
      company_id:    user.company_id,
      title:         data.title,
      department_id: data.department_id || null,
      salary_min:    data.salary_min ?? null,
      salary_max:    data.salary_max ?? null,
      cbo_code:      data.cbo_code || null,
    }
    if (editingPos) {
      const { error } = await supabase.from('positions').update(payload).eq('id', editingPos.id)
      if (error) { toast.error('Erro ao atualizar'); return }
      toast.success('Cargo atualizado!')
    } else {
      const { error } = await supabase.from('positions').insert(payload)
      if (error) { toast.error('Erro ao criar'); return }
      toast.success('Cargo criado!')
    }
    setPosDialog(false)
    load()
  }

  const handlePosDelete = async (id: string) => {
    if (!confirm('Excluir este cargo?')) return
    const supabase = createClient()
    const { error } = await supabase.from('positions').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Cargo excluído')
    load()
  }

  const getManagerName = (id: string | null) =>
    id ? employees.find((e) => e.id === id)?.full_name ?? '—' : '—'

  const getDeptName = (id: string | null) =>
    id ? departments.find((d) => d.id === id)?.name ?? '—' : '—'

  const empCountByDept = (id: string) =>
    employees.filter((e: Employee) => (e as unknown as { department_id: string }).department_id === id).length

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Departamentos e Cargos</h1>
          <p className="text-gray-500 mt-1">Estrutura organizacional da empresa</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openPosDialog()}>
            <Plus className="h-4 w-4 mr-2" /> Novo cargo
          </Button>
          <Button onClick={() => { setEditingDept(null); setDeptDialog(true) }}>
            <Plus className="h-4 w-4 mr-2" /> Novo departamento
          </Button>
        </div>
      </div>

      {/* ─── Departamentos ─── */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-600" /> Departamentos
        </h2>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : departments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <Building2 className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Nenhum departamento cadastrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {departments.map((dept) => (
              <div key={dept.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{dept.name}</p>
                    {dept.parent_id && (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <ChevronRight className="h-3 w-3" /> {getDeptName(dept.parent_id)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setEditingDept(dept); setDeptDialog(true) }}
                      className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeptDelete(dept.id)}
                      className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> Gestor
                  </span>
                  <span className="font-medium text-gray-700 text-xs truncate max-w-32">
                    {getManagerName(dept.manager_id)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Cargos ─── */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-purple-600" /> Cargos
        </h2>
        {positions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-gray-400 text-sm">Nenhum cargo cadastrado</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Cargo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Departamento</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Faixa salarial</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">CBO</th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {positions.map((pos) => (
                  <tr key={pos.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{pos.title}</td>
                    <td className="px-4 py-3 text-gray-600">{getDeptName(pos.department_id)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {pos.salary_min && pos.salary_max
                        ? `${formatCurrency(pos.salary_min)} – ${formatCurrency(pos.salary_max)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{pos.cbo_code ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => openPosDialog(pos)}
                          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handlePosDelete(pos.id)}
                          className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialog Departamento */}
      <Dialog open={deptDialog} onOpenChange={(o) => { setDeptDialog(o); if (!o) setEditingDept(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDept ? 'Editar departamento' : 'Novo departamento'}</DialogTitle>
          </DialogHeader>
          <DepartmentForm
            defaultValues={editingDept ? { name: editingDept.name, manager_id: editingDept.manager_id ?? '', parent_id: editingDept.parent_id ?? '' } : undefined}
            departments={departments.filter((d) => d.id !== editingDept?.id)}
            managers={employees}
            onSubmit={handleDeptSubmit}
            onCancel={() => { setDeptDialog(false); setEditingDept(null) }}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog Cargo */}
      <Dialog open={posDialog} onOpenChange={(o) => { setPosDialog(o); if (!o) setEditingPos(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPos ? 'Editar cargo' : 'Novo cargo'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={posForm.handleSubmit(handlePosSubmit)} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Título do cargo *</Label>
              <Input placeholder="Ex: Analista de RH" {...posForm.register('title')} />
              {posForm.formState.errors.title && (
                <p className="text-xs text-red-500">{posForm.formState.errors.title.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Departamento</Label>
              <Select
                defaultValue={nn(editingPos?.department_id)}
                onValueChange={(v) => posForm.setValue('department_id', v ?? undefined)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Salário mínimo</Label>
                <Input type="number" step="0.01" placeholder="0,00" {...posForm.register('salary_min')} />
              </div>
              <div className="space-y-1.5">
                <Label>Salário máximo</Label>
                <Input type="number" step="0.01" placeholder="0,00" {...posForm.register('salary_max')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Código CBO</Label>
              <Input placeholder="Ex: 2521-05" {...posForm.register('cbo_code')} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setPosDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={posForm.formState.isSubmitting}>
                {posForm.formState.isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
