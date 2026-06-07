'use client'

import { useEffect, useState, useCallback } from 'react'
import { Briefcase, Plus, Pencil, Trash2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency } from '@/lib/utils'
import type { Position, Department } from '@/types/database'

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

export default function PositionsPage() {
  const { user } = useAuth()

  const [positions,    setPositions]    = useState<Position[]>([])
  const [departments,  setDepartments]  = useState<Department[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [sheet,        setSheet]        = useState(false)
  const [editing,      setEditing]      = useState<Position | null>(null)
  const [form,         setForm]         = useState<FormState>(blank())
  const [saving,       setSaving]       = useState(false)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const supabase = createClient()
    const [pRes, dRes] = await Promise.all([
      supabase.from('positions').select('*').eq('company_id', user.company_id).order('title'),
      supabase.from('departments').select('*').eq('company_id', user.company_id).order('name'),
    ])
    setPositions(pRes.data ?? [])
    setDepartments(dRes.data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setForm(blank()); setSheet(true) }
  const openEdit   = (p: Position) => {
    setEditing(p)
    setForm({
      title:         p.title,
      department_id: p.department_id ?? '',
      salary_min:    p.salary_min != null ? String(p.salary_min) : '',
      salary_max:    p.salary_max != null ? String(p.salary_max) : '',
      cbo_code:      p.cbo_code ?? '',
    })
    setSheet(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured() || !user) return
    if (!form.title.trim()) { toast.error('Título obrigatório'); return }
    setSaving(true)
    const supabase = createClient()
    const payload = {
      company_id:    user.company_id,
      title:         form.title.trim(),
      department_id: form.department_id || null,
      salary_min:    form.salary_min ? +form.salary_min : null,
      salary_max:    form.salary_max ? +form.salary_max : null,
      cbo_code:      form.cbo_code.trim() || null,
    }
    if (editing) {
      const { error } = await supabase.from('positions').update(payload).eq('id', editing.id)
      if (error) { toast.error('Erro ao atualizar'); setSaving(false); return }
      toast.success('Cargo atualizado!')
    } else {
      const { error } = await supabase.from('positions').insert(payload)
      if (error) { toast.error('Erro ao criar'); setSaving(false); return }
      toast.success('Cargo criado!')
    }
    setSaving(false)
    setSheet(false)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este cargo? Funcionários vinculados perderão o vínculo.')) return
    const supabase = createClient()
    const { error } = await supabase.from('positions').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir. Verifique se há funcionários vinculados.'); return }
    toast.success('Cargo excluído')
    load()
  }

  const getDeptName = (id: string | null) => departments.find(d => d.id === id)?.name ?? '—'

  const filtered = positions.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    getDeptName(p.department_id).toLowerCase().includes(search.toLowerCase())
  )

  // Quantos funcionários por cargo (contagem simples se quisermos expandir)
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cargos</h1>
          <p className="text-gray-500 mt-1">{positions.length} cargo{positions.length !== 1 ? 's' : ''} cadastrado{positions.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Novo cargo
        </Button>
      </div>

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          className="pl-9"
          placeholder="Buscar cargo ou departamento..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="p-8 text-center text-gray-400 bg-white rounded-xl border">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
          <Briefcase className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm font-medium">
            {search ? 'Nenhum cargo encontrado' : 'Nenhum cargo cadastrado'}
          </p>
          {!search && (
            <p className="text-gray-400 text-xs mt-1">
              Crie cargos para vincular aos funcionários
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Cargo', 'Departamento', 'Faixa salarial', 'CBO', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <Briefcase className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="font-medium text-gray-900">{p.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{getDeptName(p.department_id)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.salary_min != null && p.salary_max != null
                      ? `${formatCurrency(p.salary_min)} — ${formatCurrency(p.salary_max)}`
                      : p.salary_min != null
                      ? `A partir de ${formatCurrency(p.salary_min)}`
                      : p.salary_max != null
                      ? `Até ${formatCurrency(p.salary_max)}`
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.cbo_code ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
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

      {/* Sheet */}
      <Sheet open={sheet} onOpenChange={setSheet}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? 'Editar cargo' : 'Novo cargo'}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <div className="space-y-1.5">
              <Label>Título do cargo *</Label>
              <Input
                placeholder="Ex: Analista de RH"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Departamento</Label>
              <Select
                defaultValue={form.department_id || 'none'}
                onValueChange={v => setForm(f => ({ ...f, department_id: v === 'none' ? '' : (v ?? '') }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem departamento</SelectItem>
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
                  placeholder="0,00"
                  value={form.salary_max}
                  onChange={e => setForm(f => ({ ...f, salary_max: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Código CBO</Label>
              <Input
                placeholder="Ex: 2521-05"
                value={form.cbo_code}
                onChange={e => setForm(f => ({ ...f, cbo_code: e.target.value }))}
              />
              <p className="text-xs text-gray-400">Classificação Brasileira de Ocupações (opcional)</p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setSheet(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving && <span className="mr-2 animate-spin">⟳</span>}
                {editing ? 'Salvar' : 'Criar cargo'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
