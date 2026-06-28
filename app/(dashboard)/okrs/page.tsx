'use client'

import { useEffect, useState, useCallback } from 'react'
import { Target, Plus, ChevronDown, ChevronRight, Pencil, Trash2, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export const dynamic = 'force-dynamic'

const STATUS_OKR: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  active:    { label: 'Ativo',       variant: 'default' },
  achieved:  { label: 'Alcançado',   variant: 'default' },
  cancelled: { label: 'Cancelado',   variant: 'outline' },
}

const STATUS_KR: Record<string, { label: string; color: string }> = {
  on_track: { label: 'No prazo',  color: 'text-green-600' },
  at_risk:  { label: 'Em risco',  color: 'text-yellow-600' },
  achieved: { label: 'Alcançado', color: 'text-blue-600' },
  missed:   { label: 'Não atingido', color: 'text-red-600' },
}

type KR  = { id: string; description: string; target: number; current: number; unit: string; due_date?: string; status: string }
type OKR = { id: string; employee_id: string; cycle: string; objective: string; status: string; key_results?: KR[]; employee?: { full_name: string } }

function progress(kr: KR) {
  if (kr.target === 0) return 0
  return Math.min(100, Math.round((kr.current / kr.target) * 100))
}

export default function OkrsPage() {
  const { user } = useAuth()
  const [okrs,      setOkrs]      = useState<OKR[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [expanded,  setExpanded]  = useState<string | null>(null)

  const [okrDialog, setOkrDialog] = useState(false)
  const [editOkr,   setEditOkr]   = useState<OKR | null>(null)
  const [okrForm,   setOkrForm]   = useState({ employee_id: '', cycle: '2026-Q3', objective: '' })

  const [krDialog, setKrDialog] = useState(false)
  const [krOkrId,  setKrOkrId]  = useState('')
  const [editKr,   setEditKr]   = useState<KR | null>(null)
  const [krForm,   setKrForm]   = useState({ description: '', target: '100', current: '0', unit: '%', due_date: '', status: 'on_track' })

  const [filterEmp, setFilterEmp] = useState('')
  const [filterCycle, setFilterCycle] = useState('')

  const supabase = isSupabaseConfigured() ? createClient() : null

  const load = useCallback(async () => {
    if (!supabase || !user) { setLoading(false); return }
    setLoading(true)

    const [okrRes, empRes] = await Promise.all([
      supabase.from('okrs').select('*, key_results(*), employee:employees(full_name)').eq('company_id', user.company_id).order('created_at', { ascending: false }),
      supabase.from('employees').select('id, full_name').eq('company_id', user.company_id).eq('status', 'active').order('full_name'),
    ])

    setOkrs(okrRes.data ?? [])
    setEmployees(empRes.data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // ─── OKR CRUD ───────────────────────────────────────────────
  function openCreateOkr() {
    setEditOkr(null)
    setOkrForm({ employee_id: employees[0]?.id ?? '', cycle: '2026-Q3', objective: '' })
    setOkrDialog(true)
  }
  function openEditOkr(o: OKR) {
    setEditOkr(o)
    setOkrForm({ employee_id: o.employee_id, cycle: o.cycle, objective: o.objective })
    setOkrDialog(true)
  }

  async function handleOkrSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !user) return
    if (!okrForm.objective || !okrForm.employee_id) { toast.error('Preencha todos os campos'); return }

    if (editOkr) {
      const { error } = await supabase.from('okrs').update({ objective: okrForm.objective, cycle: okrForm.cycle }).eq('id', editOkr.id)
      if (error) { toast.error('Erro ao atualizar'); return }
      toast.success('OKR atualizado!')
    } else {
      const { error } = await supabase.from('okrs').insert({ company_id: user.company_id, employee_id: okrForm.employee_id, cycle: okrForm.cycle, objective: okrForm.objective, created_by: user.id })
      if (error) { toast.error('Erro ao criar'); return }
      toast.success('OKR criado!')
    }
    setOkrDialog(false); load()
  }

  async function deleteOkr(id: string) {
    if (!supabase || !confirm('Excluir este OKR e todos os KRs?')) return
    await supabase.from('okrs').delete().eq('id', id)
    toast.success('OKR excluído'); load()
  }

  // ─── KR CRUD ────────────────────────────────────────────────
  function openCreateKr(okrId: string) {
    setKrOkrId(okrId); setEditKr(null)
    setKrForm({ description: '', target: '100', current: '0', unit: '%', due_date: '', status: 'on_track' })
    setKrDialog(true)
  }
  function openEditKr(kr: KR, okrId: string) {
    setKrOkrId(okrId); setEditKr(kr)
    setKrForm({ description: kr.description, target: String(kr.target), current: String(kr.current), unit: kr.unit, due_date: kr.due_date ?? '', status: kr.status })
    setKrDialog(true)
  }

  async function handleKrSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    const payload = { description: krForm.description, target: parseFloat(krForm.target), current: parseFloat(krForm.current), unit: krForm.unit, due_date: krForm.due_date || null, status: krForm.status, updated_at: new Date().toISOString() }

    if (editKr) {
      const { error } = await supabase.from('key_results').update(payload).eq('id', editKr.id)
      if (error) { toast.error('Erro ao atualizar KR'); return }
      toast.success('KR atualizado!')
    } else {
      const { error } = await supabase.from('key_results').insert({ ...payload, okr_id: krOkrId })
      if (error) { toast.error('Erro ao criar KR'); return }
      toast.success('KR criado!')
    }
    setKrDialog(false); load()
  }

  async function deleteKr(id: string) {
    if (!supabase || !confirm('Excluir este KR?')) return
    await supabase.from('key_results').delete().eq('id', id)
    toast.success('KR excluído'); load()
  }

  const filtered = okrs.filter(o =>
    (!filterEmp   || o.employee_id === filterEmp) &&
    (!filterCycle || o.cycle === filterCycle)
  )

  const cycles = [...new Set(okrs.map(o => o.cycle))].sort().reverse()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Target className="h-6 w-6" /> OKRs</h1>
          <p className="text-muted-foreground text-sm mt-1">Objetivos e Resultados-Chave por colaborador</p>
        </div>
        <Button onClick={openCreateOkr}><Plus className="h-4 w-4 mr-2" />Novo OKR</Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm bg-background">
          <option value="">Todos os colaboradores</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
        <select value={filterCycle} onChange={e => setFilterCycle(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm bg-background">
          <option value="">Todos os ciclos</option>
          {cycles.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Lista de OKRs */}
      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center border border-dashed rounded-xl text-muted-foreground">
          <Target className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum OKR cadastrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(okr => {
            const krs  = okr.key_results ?? []
            const avg  = krs.length ? Math.round(krs.reduce((s, k) => s + progress(k), 0) / krs.length) : 0
            const open = expanded === okr.id
            return (
              <div key={okr.id} className="bg-card border rounded-xl overflow-hidden">
                <div className="p-4 flex items-center gap-3">
                  <button onClick={() => setExpanded(open ? null : okr.id)} className="shrink-0">
                    {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  <div className="flex-1 min-w-0" onClick={() => setExpanded(open ? null : okr.id)} role="button">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{okr.objective}</p>
                      <Badge variant="outline" className="text-xs shrink-0">{okr.cycle}</Badge>
                      <Badge variant={STATUS_OKR[okr.status]?.variant ?? 'secondary'} className="text-xs shrink-0">
                        {STATUS_OKR[okr.status]?.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{okr.employee?.full_name} · {krs.length} KR{krs.length !== 1 ? 's' : ''} · {avg}% concluído</p>
                    {krs.length > 0 && (
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${avg}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEditOkr(okr)} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => deleteOkr(okr.id)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>

                {open && (
                  <div className="border-t px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key Results</p>
                      <Button size="sm" variant="outline" onClick={() => openCreateKr(okr.id)}>
                        <Plus className="h-3 w-3 mr-1" /> Adicionar KR
                      </Button>
                    </div>
                    {krs.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2 text-center">Nenhum KR ainda</p>
                    ) : krs.map(kr => {
                      const pct = progress(kr)
                      const sc  = STATUS_KR[kr.status] ?? STATUS_KR.on_track!
                      return (
                        <div key={kr.id} className="rounded-lg border p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{kr.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {kr.current} / {kr.target} {kr.unit}
                                {kr.due_date && ` · até ${new Date(kr.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}`}
                                <span className={` · ${sc.color} font-medium`}>{sc.label}</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-sm font-bold">{pct}%</span>
                              <button onClick={() => openEditKr(kr, okr.id)} className="p-1 rounded hover:bg-muted text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                              <button onClick={() => deleteKr(kr.id)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-primary' : pct >= 30 ? 'bg-yellow-500' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Dialog OKR */}
      <Dialog open={okrDialog} onOpenChange={setOkrDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editOkr ? 'Editar OKR' : 'Novo OKR'}</DialogTitle></DialogHeader>
          <form onSubmit={handleOkrSubmit} className="space-y-4 pt-2">
            {!editOkr && (
              <div className="space-y-1.5">
                <Label>Colaborador *</Label>
                <select value={okrForm.employee_id} onChange={e => setOkrForm(f => ({ ...f, employee_id: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                  <option value="">Selecione...</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Ciclo *</Label>
              <Input placeholder="Ex: 2026-Q3, 2026-S2, 2026" value={okrForm.cycle}
                onChange={e => setOkrForm(f => ({ ...f, cycle: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Objetivo *</Label>
              <Input placeholder="Ex: Aumentar satisfação dos clientes" value={okrForm.objective}
                onChange={e => setOkrForm(f => ({ ...f, objective: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setOkrDialog(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog KR */}
      <Dialog open={krDialog} onOpenChange={setKrDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editKr ? 'Editar Key Result' : 'Novo Key Result'}</DialogTitle></DialogHeader>
          <form onSubmit={handleKrSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Descrição *</Label>
              <Input placeholder="Ex: Atingir NPS ≥ 70" value={krForm.description}
                onChange={e => setKrForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Meta</Label>
                <Input type="number" value={krForm.target} onChange={e => setKrForm(f => ({ ...f, target: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Atual</Label>
                <Input type="number" value={krForm.current} onChange={e => setKrForm(f => ({ ...f, current: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Unidade</Label>
                <Input placeholder="%" value={krForm.unit} onChange={e => setKrForm(f => ({ ...f, unit: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prazo</Label>
                <Input type="date" value={krForm.due_date} onChange={e => setKrForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select value={krForm.status} onChange={e => setKrForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                  {Object.entries(STATUS_KR).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setKrDialog(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
