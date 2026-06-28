'use client'

import { useEffect, useState, useCallback } from 'react'
import { Layers, Plus, Pencil, Trash2, TrendingUp, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export const dynamic = 'force-dynamic'

const LEVELS = [
  { value: 'junior',       label: 'Júnior' },
  { value: 'pleno',        label: 'Pleno' },
  { value: 'senior',       label: 'Sênior' },
  { value: 'especialista', label: 'Especialista' },
  { value: 'coordenador',  label: 'Coordenador' },
  { value: 'gerente',      label: 'Gerente' },
  { value: 'diretor',      label: 'Diretor' },
]

const LEVEL_LABEL: Record<string, string> = Object.fromEntries(LEVELS.map(l => [l.value, l.label]))

const brl = (n?: number | null) =>
  n != null ? `R$ ${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'

type Band = {
  id: string
  position_id: string
  level: string
  min_salary: number
  mid_salary: number | null
  max_salary: number
  position?: { title: string; department?: { name: string } }
}

type Position = { id: string; title: string; department?: { name: string } }
type Employee = { id: string; full_name: string; salary: number | null; position_id: string | null }

type BandForm = {
  position_id: string
  level: string
  min_salary: string
  mid_salary: string
  max_salary: string
}

const blank = (): BandForm => ({ position_id: '', level: 'pleno', min_salary: '', mid_salary: '', max_salary: '' })

function pct(value: number, min: number, max: number) {
  if (max === min) return 50
  return Math.round(Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)))
}

function BandBar({ salary, min, mid, max }: { salary: number; min: number; mid?: number | null; max: number }) {
  const p = pct(salary, min, max)
  const status = salary < min ? 'abaixo' : salary > max ? 'acima' : 'dentro'
  return (
    <div className="w-full">
      <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
        {mid && (
          <div className="absolute top-0 h-full w-px bg-gray-400" style={{ left: `${pct(mid, min, max)}%` }} />
        )}
        <div className={`absolute top-0 h-full w-2 -ml-1 rounded-full ${
          status === 'abaixo' ? 'bg-red-500' : status === 'acima' ? 'bg-orange-500' : 'bg-green-500'
        }`} style={{ left: `${Math.max(0, Math.min(98, p))}%` }} />
        <div className="absolute inset-0 border border-gray-200 rounded-full" />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-0.5">
        <span>{brl(min)}</span>
        {mid && <span className="text-gray-300">{brl(mid)}</span>}
        <span>{brl(max)}</span>
      </div>
    </div>
  )
}

export default function PcsPage() {
  const { user } = useAuth()
  const [bands,     setBands]     = useState<Band[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading,   setLoading]   = useState(true)
  const [dialog,    setDialog]    = useState(false)
  const [editing,   setEditing]   = useState<Band | null>(null)
  const [form,      setForm]      = useState<BandForm>(blank())
  const [saving,    setSaving]    = useState(false)
  const [tab,       setTab]       = useState<'bands' | 'analysis'>('bands')

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const sb = createClient()
    const [bRes, pRes, eRes] = await Promise.allSettled([
      sb.from('salary_bands')
        .select('*, position:positions(title, department:departments(name))')
        .eq('company_id', user.company_id)
        .order('level'),
      sb.from('positions').select('id, title, department:departments(name)').eq('company_id', user.company_id).order('title'),
      sb.from('employees').select('id, full_name, salary, position_id').eq('company_id', user.company_id).eq('status', 'active'),
    ])
    if (bRes.status === 'fulfilled') setBands((bRes.value.data ?? []) as Band[])
    if (pRes.status === 'fulfilled') setPositions((pRes.value.data ?? []) as Position[])
    if (eRes.status === 'fulfilled') setEmployees((eRes.value.data ?? []) as Employee[])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const openNew  = () => { setEditing(null); setForm(blank()); setDialog(true) }
  const openEdit = (b: Band) => {
    setEditing(b)
    setForm({
      position_id: b.position_id,
      level: b.level,
      min_salary: String(b.min_salary),
      mid_salary: b.mid_salary != null ? String(b.mid_salary) : '',
      max_salary: String(b.max_salary),
    })
    setDialog(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.position_id) { toast.error('Selecione o cargo'); return }
    if (!form.min_salary || !form.max_salary) { toast.error('Informe os salários mínimo e máximo'); return }
    const min = Number(form.min_salary.replace(/[^0-9,]/g, '').replace(',', '.'))
    const max = Number(form.max_salary.replace(/[^0-9,]/g, '').replace(',', '.'))
    const mid = form.mid_salary ? Number(form.mid_salary.replace(/[^0-9,]/g, '').replace(',', '.')) : null
    if (min >= max) { toast.error('O salário mínimo deve ser menor que o máximo'); return }
    setSaving(true)
    const sb = createClient()
    const payload = {
      company_id: user!.company_id, position_id: form.position_id, level: form.level,
      min_salary: min, mid_salary: mid, max_salary: max,
    }
    const { error } = editing
      ? await sb.from('salary_bands').update(payload).eq('id', editing.id)
      : await sb.from('salary_bands').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message.includes('unique') ? 'Já existe uma faixa para esse cargo/nível' : 'Erro ao salvar'); return }
    toast.success(editing ? 'Faixa atualizada' : 'Faixa criada')
    setDialog(false); load()
  }

  const remove = async (id: string) => {
    if (!confirm('Excluir esta faixa salarial?')) return
    const { error } = await createClient().from('salary_bands').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Excluído'); load()
  }

  // Agrupa faixas por cargo
  const grouped = bands.reduce<Record<string, Band[]>>((acc, b) => {
    const key = b.position_id
    if (!acc[key]) acc[key] = []
    acc[key]!.push(b)
    return acc
  }, {})

  // Análise: cruza empregado × faixa
  type EmpAnalysis = Employee & {
    position_title: string
    band?: Band
    status: 'dentro' | 'abaixo' | 'acima' | 'sem_faixa'
  }

  const analysis: EmpAnalysis[] = employees.map(e => {
    const pos = positions.find(p => p.id === e.position_id)
    const posTitle = pos?.title ?? 'Cargo não definido'
    const posBands = e.position_id ? (grouped[e.position_id] ?? []) : []
    if (e.salary == null || posBands.length === 0) {
      return { ...e, position_title: posTitle, status: 'sem_faixa' as const }
    }
    // usa a faixa com melhor encaixe de salário (menor distância)
    const best = posBands.reduce((prev, curr) => {
      const prevDist = Math.abs(e.salary! - ((prev.min_salary + prev.max_salary) / 2))
      const currDist = Math.abs(e.salary! - ((curr.min_salary + curr.max_salary) / 2))
      return currDist < prevDist ? curr : prev
    })
    const status = e.salary < best.min_salary ? 'abaixo' : e.salary > best.max_salary ? 'acima' : 'dentro'
    return { ...e, position_title: posTitle, band: best, status }
  })

  const counts = {
    dentro: analysis.filter(a => a.status === 'dentro').length,
    abaixo: analysis.filter(a => a.status === 'abaixo').length,
    acima:  analysis.filter(a => a.status === 'acima').length,
    sem:    analysis.filter(a => a.status === 'sem_faixa').length,
  }

  if (loading) return <div className="p-8 text-center text-gray-400"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6" /> Plano de Cargos e Salários
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Defina faixas salariais por cargo e nível • analise aderência da equipe
          </p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Nova faixa</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([['bands', 'Tabela de faixas'], ['analysis', 'Análise da equipe']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>{label}</button>
        ))}
      </div>

      {/* ─── Aba: Tabela de faixas ─────────────────────────────── */}
      {tab === 'bands' && (
        bands.length === 0 ? (
          <div className="border border-dashed rounded-xl p-12 text-center text-muted-foreground">
            <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="font-medium">Nenhuma faixa cadastrada</p>
            <p className="text-sm mt-1">Clique em "Nova faixa" para definir as bandas salariais</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([posId, posBands]) => {
              const pos = posBands[0]?.position
              return (
                <div key={posId} className="bg-card border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-muted/40 border-b">
                    <p className="font-semibold">{pos?.title ?? 'Cargo'}</p>
                    {pos?.department && <p className="text-xs text-muted-foreground">{(pos.department as any).name}</p>}
                  </div>
                  <div className="divide-y">
                    {[...posBands].sort((a, b) => LEVELS.findIndex(l => l.value === a.level) - LEVELS.findIndex(l => l.value === b.level))
                      .map(band => (
                        <div key={band.id} className="flex items-center gap-4 px-4 py-3">
                          <div className="w-28 shrink-0">
                            <Badge variant="secondary">{LEVEL_LABEL[band.level] ?? band.level}</Badge>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex gap-3 text-sm mb-1.5">
                              <span className="text-green-600 font-medium">{brl(band.min_salary)}</span>
                              {band.mid_salary && <span className="text-gray-400">mid: {brl(band.mid_salary)}</span>}
                              <span className="text-blue-600 font-medium">{brl(band.max_salary)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>amplitude {band.max_salary && band.min_salary
                                ? `${Math.round(((band.max_salary - band.min_salary) / band.min_salary) * 100)}%` : '—'}</span>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => openEdit(band)}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => remove(band.id)}
                              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ─── Aba: Análise da equipe ────────────────────────────── */}
      {tab === 'analysis' && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Dentro da faixa', value: counts.dentro, Icon: CheckCircle2, color: 'text-green-600' },
              { label: 'Abaixo do mínimo', value: counts.abaixo, Icon: AlertTriangle, color: 'text-red-600' },
              { label: 'Acima do máximo', value: counts.acima, Icon: TrendingUp, color: 'text-orange-500' },
              { label: 'Sem faixa', value: counts.sem, Icon: Layers, color: 'text-gray-400' },
            ].map(({ label, value, Icon, color }) => (
              <div key={label} className="bg-card border rounded-xl p-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className={`text-2xl font-bold mt-1 flex items-center gap-1.5 ${color}`}>
                  {value}
                  <Icon className="h-5 w-5" />
                </p>
              </div>
            ))}
          </div>

          {/* Tabela */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium">Colaborador</th>
                  <th className="text-left px-4 py-3 font-medium">Cargo</th>
                  <th className="text-left px-4 py-3 font-medium">Salário atual</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Posição na faixa</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {analysis.map(a => (
                  <tr key={a.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{a.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.position_title}</td>
                    <td className="px-4 py-3">{brl(a.salary)}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {a.band && a.salary ? (
                        <div className="max-w-xs">
                          <BandBar salary={a.salary} min={a.band.min_salary} mid={a.band.mid_salary} max={a.band.max_salary} />
                        </div>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {a.status === 'dentro'    && <Badge className="bg-green-100 text-green-700 border-green-200">Dentro</Badge>}
                      {a.status === 'abaixo'    && <Badge className="bg-red-100 text-red-700 border-red-200">Abaixo</Badge>}
                      {a.status === 'acima'     && <Badge className="bg-orange-100 text-orange-700 border-orange-200">Acima</Badge>}
                      {a.status === 'sem_faixa' && <Badge variant="secondary">Sem faixa</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {analysis.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">Nenhum colaborador ativo encontrado</div>
            )}
          </div>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar faixa salarial' : 'Nova faixa salarial'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Cargo *</Label>
              <Select value={form.position_id} onValueChange={v => setForm(f => ({ ...f, position_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                <SelectContent>
                  {positions.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}{p.department ? ` — ${(p.department as any).name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nível *</Label>
              <Select value={form.level} onValueChange={v => setForm(f => ({ ...f, level: v ?? 'pleno' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Mínimo *</Label>
                <Input placeholder="Ex: 3000" value={form.min_salary}
                  onChange={e => setForm(f => ({ ...f, min_salary: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Médio</Label>
                <Input placeholder="Opcional" value={form.mid_salary}
                  onChange={e => setForm(f => ({ ...f, mid_salary: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Máximo *</Label>
                <Input placeholder="Ex: 5000" value={form.max_salary}
                  onChange={e => setForm(f => ({ ...f, max_salary: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editing ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
