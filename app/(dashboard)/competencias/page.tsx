'use client'

import { useEffect, useState, useCallback } from 'react'
import { Brain, Plus, Pencil, Trash2, Loader2, Search, Star } from 'lucide-react'
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

const CATEGORIES = {
  tecnica:         { label: 'Técnica',         color: 'bg-blue-100 text-blue-700' },
  comportamental:  { label: 'Comportamental',  color: 'bg-purple-100 text-purple-700' },
  lideranca:       { label: 'Liderança',       color: 'bg-orange-100 text-orange-700' },
  idioma:          { label: 'Idioma',          color: 'bg-green-100 text-green-700' },
}

const LEVELS = ['', 'Básico', 'Iniciante', 'Intermediário', 'Avançado', 'Especialista']

type Competency = { id: string; name: string; category: string; description?: string }
type EmpComp = {
  id: string; employee_id: string; competency_id: string; level: number; notes?: string; assessed_at: string
  employee?: { full_name: string; department?: { name: string } }
  competency?: { name: string; category: string }
}
type Employee = { id: string; full_name: string; department?: { name: string } }

function Stars({ level, onChange }: { level: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <button key={i} type="button" onClick={() => onChange?.(i)}
          className={onChange ? 'cursor-pointer' : 'cursor-default'}>
          <Star className={`h-4 w-4 ${i <= level ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
        </button>
      ))}
    </div>
  )
}

export default function CompetenciasPage() {
  const { user } = useAuth()
  const [tab,          setTab]        = useState<'matriz' | 'competencias'>('matriz')
  const [competencies, setCompetencies] = useState<Competency[]>([])
  const [assessments,  setAssessments]  = useState<EmpComp[]>([])
  const [employees,    setEmployees]    = useState<Employee[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')

  // Dialogs
  const [compDialog,   setCompDialog]   = useState(false)
  const [assessDialog, setAssessDialog] = useState(false)
  const [editingComp,  setEditingComp]  = useState<Competency | null>(null)
  const [saving,       setSaving]       = useState(false)

  const [compForm, setCompForm] = useState({ name: '', category: 'tecnica', description: '' })
  const [assForm,  setAssForm]  = useState({ employee_id: '', competency_id: '', level: 3, notes: '', assessed_at: new Date().toISOString().slice(0,10) })

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const sb = createClient()
    const [cRes, aRes, eRes] = await Promise.allSettled([
      sb.from('competencies').select('*').eq('company_id', user.company_id).order('category').order('name'),
      sb.from('employee_competencies')
        .select('*, employee:employees(full_name, department:departments(name)), competency:competencies(name, category)')
        .eq('company_id', user.company_id)
        .order('assessed_at', { ascending: false }),
      sb.from('employees').select('id, full_name, department:departments(name)').eq('company_id', user.company_id).eq('status', 'active').order('full_name'),
    ])
    if (cRes.status === 'fulfilled') setCompetencies((cRes.value.data ?? []) as Competency[])
    if (aRes.status === 'fulfilled') setAssessments((aRes.value.data ?? []) as EmpComp[])
    if (eRes.status === 'fulfilled') setEmployees((eRes.value.data ?? []) as Employee[])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const saveComp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!compForm.name.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    const sb = createClient()
    const payload = { company_id: user!.company_id, name: compForm.name.trim(), category: compForm.category, description: compForm.description || null }
    const { error } = editingComp
      ? await sb.from('competencies').update(payload).eq('id', editingComp.id)
      : await sb.from('competencies').insert(payload)
    setSaving(false)
    if (error) { toast.error('Erro ao salvar'); return }
    toast.success(editingComp ? 'Competência atualizada' : 'Competência criada')
    setCompDialog(false); setEditingComp(null); load()
  }

  const saveAssessment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assForm.employee_id || !assForm.competency_id) { toast.error('Selecione colaborador e competência'); return }
    setSaving(true)
    const sb = createClient()
    const { error } = await sb.from('employee_competencies').upsert({
      company_id: user!.company_id,
      employee_id: assForm.employee_id,
      competency_id: assForm.competency_id,
      level: assForm.level,
      notes: assForm.notes || null,
      assessed_at: assForm.assessed_at,
      assessed_by: user!.id,
    }, { onConflict: 'employee_id,competency_id' })
    setSaving(false)
    if (error) { toast.error('Erro ao salvar avaliação'); return }
    toast.success('Avaliação salva!')
    setAssessDialog(false); load()
  }

  const deleteComp = async (id: string) => {
    if (!confirm('Excluir esta competência? As avaliações vinculadas também serão excluídas.')) return
    const { error } = await createClient().from('competencies').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Competência excluída'); load()
  }

  // Monta a matriz: linhas = employees, colunas = competencies
  const filteredEmps = employees.filter(e =>
    !search || e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (e.department as any)?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const getLevel = (empId: string, compId: string) =>
    assessments.find(a => a.employee_id === empId && a.competency_id === compId)?.level ?? 0

  const avgLevel = (compId: string) => {
    const levels = assessments.filter(a => a.competency_id === compId).map(a => a.level)
    return levels.length ? (levels.reduce((s, l) => s + l, 0) / levels.length).toFixed(1) : '—'
  }

  if (loading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" /> Matriz de Competências
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Mapeie e avalie competências técnicas, comportamentais e de liderança
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setCompForm({ name: '', category: 'tecnica', description: '' }); setEditingComp(null); setCompDialog(true) }}>
            <Plus className="h-4 w-4 mr-2" /> Nova competência
          </Button>
          <Button onClick={() => { setAssForm({ employee_id: '', competency_id: '', level: 3, notes: '', assessed_at: new Date().toISOString().slice(0,10) }); setAssessDialog(true) }}>
            <Star className="h-4 w-4 mr-2" /> Avaliar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([['matriz', 'Matriz geral'], ['competencias', 'Competências cadastradas']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>{label}</button>
        ))}
      </div>

      {/* ─── Matriz ──────────────────────────────────────────── */}
      {tab === 'matriz' && (
        competencies.length === 0 || employees.length === 0 ? (
          <div className="border border-dashed rounded-xl p-12 text-center text-muted-foreground">
            <Brain className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="font-medium">Cadastre competências e colaboradores para ver a matriz</p>
          </div>
        ) : (
          <>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Filtrar colaborador..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="overflow-x-auto border rounded-xl">
              <table className="text-sm w-full">
                <thead>
                  <tr className="bg-muted/40 border-b">
                    <th className="text-left px-4 py-3 font-medium sticky left-0 bg-muted/40 min-w-[180px]">Colaborador</th>
                    {competencies.map(c => (
                      <th key={c.id} className="px-3 py-3 font-medium text-center min-w-[110px]">
                        <div>{c.name}</div>
                        <div className={`text-xs font-normal mt-0.5 px-1.5 py-0.5 rounded-full inline-block ${CATEGORIES[c.category as keyof typeof CATEGORIES]?.color ?? ''}`}>
                          {CATEGORIES[c.category as keyof typeof CATEGORIES]?.label ?? c.category}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">média: {avgLevel(c.id)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredEmps.map(emp => (
                    <tr key={emp.id} className="hover:bg-muted/10">
                      <td className="px-4 py-3 sticky left-0 bg-background border-r">
                        <p className="font-medium">{emp.full_name}</p>
                        <p className="text-xs text-muted-foreground">{(emp.department as any)?.name ?? '—'}</p>
                      </td>
                      {competencies.map(c => {
                        const lv = getLevel(emp.id, c.id)
                        return (
                          <td key={c.id} className="px-3 py-3 text-center">
                            {lv > 0 ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <Stars level={lv} />
                                <span className="text-xs text-muted-foreground">{LEVELS[lv]}</span>
                              </div>
                            ) : (
                              <span className="text-gray-300 text-lg">—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      )}

      {/* ─── Competências cadastradas ─────────────────────────── */}
      {tab === 'competencias' && (
        competencies.length === 0 ? (
          <div className="border border-dashed rounded-xl p-12 text-center text-muted-foreground">
            <Brain className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>Nenhuma competência cadastrada</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {competencies.map(c => {
              const cat = CATEGORIES[c.category as keyof typeof CATEGORIES]
              const count = assessments.filter(a => a.competency_id === c.id).length
              return (
                <div key={c.id} className="bg-card border rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{c.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${cat?.color ?? ''}`}>{cat?.label ?? c.category}</span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setEditingComp(c); setCompForm({ name: c.name, category: c.category, description: c.description ?? '' }); setCompDialog(true) }}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => deleteComp(c.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
                  <p className="text-xs text-muted-foreground">{count} avaliação{count !== 1 ? 'ões' : ''} · média {avgLevel(c.id)}</p>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Dialog: Competência */}
      <Dialog open={compDialog} onOpenChange={v => { setCompDialog(v); if (!v) setEditingComp(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingComp ? 'Editar competência' : 'Nova competência'}</DialogTitle></DialogHeader>
          <form onSubmit={saveComp} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="Ex: Excel Avançado" value={compForm.name}
                onChange={e => setCompForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={compForm.category} onValueChange={v => setCompForm(f => ({ ...f, category: v ?? 'tecnica' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea rows={2} value={compForm.description}
                onChange={e => setCompForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setCompDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{editingComp ? 'Salvar' : 'Criar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Avaliação */}
      <Dialog open={assessDialog} onOpenChange={setAssessDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Avaliar competência</DialogTitle></DialogHeader>
          <form onSubmit={saveAssessment} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Colaborador *</Label>
              <Select value={assForm.employee_id} onValueChange={v => setAssForm(f => ({ ...f, employee_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Competência *</Label>
              <Select value={assForm.competency_id} onValueChange={v => setAssForm(f => ({ ...f, competency_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{competencies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nível — {LEVELS[assForm.level]}</Label>
              <Stars level={assForm.level} onChange={n => setAssForm(f => ({ ...f, level: n }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Data da avaliação</Label>
              <Input type="date" value={assForm.assessed_at} onChange={e => setAssForm(f => ({ ...f, assessed_at: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea rows={2} value={assForm.notes} onChange={e => setAssForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setAssessDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
