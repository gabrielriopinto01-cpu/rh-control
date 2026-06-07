'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Plus, Pencil, Trash2, Briefcase, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency } from '@/lib/utils'
import type { Department, Position } from '@/types/database'

export const dynamic = 'force-dynamic'

type FormState = {
  title: string
  department_id: string
  salary_min: string
  salary_max: string
  cbo_code: string
}

const blank = (): FormState => ({
  title: '', department_id: '', salary_min: '', salary_max: '', cbo_code: '',
})

function maskCBO(v: string) {
  return v.replace(/\D/g, '').slice(0, 7)
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export default function CargosPage() {
  const { user } = useAuth()

  const [positions,    setPositions]    = useState<Position[]>([])
  const [departments,  setDepartments]  = useState<Department[]>([])
  const [loading,      setLoading]      = useState(true)
  const [dialog,       setDialog]       = useState(false)
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [form,         setForm]         = useState<FormState>(blank())
  const [saving,       setSaving]       = useState(false)
  const [search,       setSearch]       = useState('')
  const [filterDept,   setFilterDept]   = useState('all')
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())

  const isReadOnly = user?.role === 'gestor' || user?.role === 'colaborador'

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const supabase = createClient()
    const [posRes, deptRes] = await Promise.allSettled([
      supabase.from('positions').select('*').eq('company_id', user.company_id).order('title'),
      supabase.from('departments').select('*').eq('company_id', user.company_id).order('name'),
    ])
    const pos  = posRes.status  === 'fulfilled' ? (posRes.value.data  ?? []) : []
    const dept = deptRes.status === 'fulfilled' ? (deptRes.value.data ?? []) : []
    setPositions(pos)
    setDepartments(dept)
    // Expandir todos os departamentos por padrão
    setExpandedDepts(new Set(dept.map(d => d.id)))
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditingId(null)
    setForm(blank())
    setDialog(true)
  }

  const openEdit = (p: Position) => {
    setEditingId(p.id)
    setForm({
      title:         p.title,
      department_id: p.department_id ?? '',
      salary_min:    p.salary_min != null ? String(p.salary_min) : '',
      salary_max:    p.salary_max != null ? String(p.salary_max) : '',
      cbo_code:      p.cbo_code ?? '',
    })
    setDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured() || !user) return
    if (!form.title.trim()) { toast.error('Nome do cargo obrigatório'); return }

    setSaving(true)
    const supabase = createClient()
    const payload = {
      company_id:    user.company_id,
      title:         form.title.trim(),
      department_id: form.department_id || null,
      salary_min:    form.salary_min ? Number(form.salary_min) : null,
      salary_max:    form.salary_max ? Number(form.salary_max) : null,
      cbo_code:      form.cbo_code || null,
    }

    if (editingId) {
      const { error } = await supabase.from('positions').update(payload).eq('id', editingId)
      if (error) { toast.error('Erro ao atualizar cargo'); setSaving(false); return }
      toast.success('Cargo atualizado!')
    } else {
      const { error } = await supabase.from('positions').insert(payload)
      if (error) { toast.error('Erro ao criar cargo'); setSaving(false); return }
      toast.success('Cargo criado!')
    }

    setSaving(false)
    setDialog(false)
    load()
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Excluir o cargo "${title}"?\n\nColaboradores vinculados a este cargo não serão afetados.`)) return
    const supabase = createClient()
    const { error } = await supabase.from('positions').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir cargo'); return }
    toast.success('Cargo excluído')
    load()
  }

  const toggleDept = (id: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Filtro e agrupamento por departamento
  const filtered = useMemo(() => {
    let list = positions
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => p.title.toLowerCase().includes(q) || (p.cbo_code ?? '').includes(q))
    }
    if (filterDept !== 'all') {
      list = filterDept === '__sem_dept__'
        ? list.filter(p => !p.department_id)
        : list.filter(p => p.department_id === filterDept)
    }
    return list
  }, [positions, search, filterDept])

  const grouped = useMemo(() => {
    const map = new Map<string, { dept: Department | null; positions: Position[] }>()

    // Sem departamento
    const semDept = filtered.filter(p => !p.department_id)
    if (semDept.length > 0) {
      map.set('__sem_dept__', { dept: null, positions: semDept })
    }

    // Por departamento
    for (const dept of departments) {
      const list = filtered.filter(p => p.department_id === dept.id)
      if (list.length > 0) {
        map.set(dept.id, { dept, positions: list })
      }
    }

    return map
  }, [filtered, departments])

  const stats = useMemo(() => ({
    total:    positions.length,
    comFaixa: positions.filter(p => p.salary_min != null || p.salary_max != null).length,
    comCBO:   positions.filter(p => p.cbo_code).length,
    depts:    new Set(positions.map(p => p.department_id).filter(Boolean)).size,
  }), [positions])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cargos</h1>
          <p className="text-gray-500 mt-1">Estrutura de cargos e faixas salariais</p>
        </div>
        {!isReadOnly && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Novo cargo
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total de cargos',    value: stats.total,    color: 'text-blue-600' },
          { label: 'Departamentos',      value: stats.depts,    color: 'text-purple-600' },
          { label: 'Com faixa salarial', value: stats.comFaixa, color: 'text-green-600' },
          { label: 'Com código CBO',     value: stats.comCBO,   color: 'text-orange-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar cargo ou CBO..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select defaultValue="all" onValueChange={v => setFilterDept(v ?? 'all')}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Todos os departamentos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os departamentos</SelectItem>
            <SelectItem value="__sem_dept__">Sem departamento</SelectItem>
            {departments.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista agrupada */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          Carregando...
        </div>
      ) : grouped.size === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <Briefcase className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">
            {search || filterDept !== 'all' ? 'Nenhum cargo encontrado para este filtro' : 'Nenhum cargo cadastrado'}
          </p>
          {!isReadOnly && !search && filterDept === 'all' && (
            <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Criar primeiro cargo
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from(grouped.entries()).map(([key, { dept, positions: list }]) => {
            const isExpanded = expandedDepts.has(key)
            const deptName = dept?.name ?? 'Sem departamento'
            return (
              <div key={key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Cabeçalho do grupo */}
                <button
                  onClick={() => toggleDept(key)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-gray-400" />
                      : <ChevronRight className="h-4 w-4 text-gray-400" />
                    }
                    <span className="font-semibold text-gray-800">{deptName}</span>
                    <Badge variant="secondary" className="text-xs">{list.length} cargo{list.length !== 1 ? 's' : ''}</Badge>
                  </div>
                </button>

                {/* Cargos do grupo */}
                {isExpanded && (
                  <>
                    <Separator />
                    <div className="divide-y divide-gray-100">
                      {list.map(pos => (
                        <div key={pos.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50 gap-4">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                              <Briefcase className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 truncate">{pos.title}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                {pos.cbo_code && (
                                  <span className="text-xs text-gray-400">CBO {pos.cbo_code}</span>
                                )}
                                {(pos.salary_min != null || pos.salary_max != null) && (
                                  <span className="text-xs text-green-700 font-medium">
                                    {pos.salary_min != null && pos.salary_max != null
                                      ? `${formatCurrency(pos.salary_min)} – ${formatCurrency(pos.salary_max)}`
                                      : pos.salary_min != null
                                        ? `A partir de ${formatCurrency(pos.salary_min)}`
                                        : `Até ${formatCurrency(pos.salary_max!)}`
                                    }
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {!isReadOnly && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => openEdit(pos)}
                                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(pos.id, pos.title)}
                                className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Dialog criar/editar */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar cargo' : 'Novo cargo'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Nome do cargo *</Label>
              <Input
                placeholder="Ex: Analista de RH"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Departamento</Label>
              <Select
                value={form.department_id || '__none__'}
                onValueChange={v => setForm(f => ({ ...f, department_id: v === '__none__' ? '' : (v ?? '') }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem departamento</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Salário mínimo</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={form.salary_min}
                  onChange={e => setForm(f => ({ ...f, salary_min: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Salário máximo</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={form.salary_max}
                  onChange={e => setForm(f => ({ ...f, salary_max: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Código CBO</Label>
              <Input
                placeholder="0000-00"
                value={form.cbo_code}
                onChange={e => setForm(f => ({ ...f, cbo_code: maskCBO(e.target.value) }))}
                maxLength={7}
              />
              <p className="text-xs text-gray-400">Classificação Brasileira de Ocupações (opcional)</p>
            </div>

            <Separator />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar cargo'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
