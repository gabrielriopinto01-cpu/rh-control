'use client'

import { useEffect, useState, useCallback } from 'react'
import { Star, Plus, Pencil, Trash2, CheckCircle2, Circle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatDate } from '@/lib/utils'
import type { PerformanceReview, Employee } from '@/types/database'

export const dynamic = 'force-dynamic'

type ReviewStatus = 'draft' | 'submitted' | 'acknowledged'

const STATUS_MAP: Record<ReviewStatus, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  draft:        { label: 'Rascunho',    variant: 'outline' },
  submitted:    { label: 'Enviada',     variant: 'secondary' },
  acknowledged: { label: 'Concluída',  variant: 'default' },
}

type Goal = { title: string; achieved: boolean }

type ReviewForm = {
  employee_id: string
  period: string
  score: string
  feedback: string
  status: ReviewStatus
  review_type: 'manager' | 'self' | 'peer'
  goals: Goal[]
}

const REVIEW_TYPE_LABELS: Record<string, string> = {
  manager: 'Avaliação do gestor', self: 'Autoavaliação', peer: 'Avaliação 360° (par)',
}

function ScoreStars({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400 text-sm">—</span>
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`h-4 w-4 ${i <= score ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
      ))}
      <span className="ml-1 text-sm text-gray-500">({score}/5)</span>
    </div>
  )
}

export default function PerformancePage() {
  const { user } = useAuth()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [reviews,   setReviews]   = useState<PerformanceReview[]>([])
  const [loading,   setLoading]   = useState(true)
  const [dialog,    setDialog]    = useState(false)
  const [detailRev, setDetailRev] = useState<PerformanceReview | null>(null)
  const [editingRev,setEditingRev]= useState<PerformanceReview | null>(null)
  const [newGoal,   setNewGoal]   = useState('')

  const blankForm = (): ReviewForm => ({
    employee_id: '', period: '', score: '', feedback: '', status: 'draft', review_type: 'manager', goals: [],
  })
  const [form, setForm] = useState<ReviewForm>(blankForm)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const supabase = createClient()
    const [e, r] = await Promise.all([
      supabase.from('employees').select('*').eq('company_id', user.company_id)
        .eq('status', 'active').order('full_name'),
      supabase.from('performance_reviews').select('*').eq('company_id', user.company_id)
        .order('created_at', { ascending: false }),
    ])
    setEmployees(e.data ?? [])
    setReviews(r.data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditingRev(null); setForm(blankForm()); setDialog(true) }
  const openEdit = (rev: PerformanceReview) => {
    setEditingRev(rev)
    setForm({
      employee_id: rev.employee_id,
      period:      rev.period,
      score:       rev.score !== null ? String(rev.score) : '',
      feedback:    rev.feedback ?? '',
      status:      rev.status,
      review_type: rev.review_type ?? 'manager',
      goals:       rev.goals ?? [],
    })
    setDialog(true)
  }

  const addGoal = () => {
    if (!newGoal.trim()) return
    setForm(f => ({ ...f, goals: [...f.goals, { title: newGoal.trim(), achieved: false }] }))
    setNewGoal('')
  }

  const toggleGoal = (idx: number) => {
    setForm(f => ({
      ...f,
      goals: f.goals.map((g, i) => i === idx ? { ...g, achieved: !g.achieved } : g),
    }))
  }

  const removeGoal = (idx: number) => {
    setForm(f => ({ ...f, goals: f.goals.filter((_, i) => i !== idx) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured() || !user) return
    if (!form.employee_id || !form.period) { toast.error('Colaborador e período são obrigatórios'); return }
    const supabase = createClient()
    const scoreNum = form.score ? Number(form.score) : null
    const payload = {
      company_id:  user.company_id,
      employee_id: form.employee_id,
      reviewer_id: user.id,
      period:      form.period,
      score:       scoreNum,
      feedback:    form.feedback || null,
      status:      form.status,
      review_type: form.review_type,
      goals:       form.goals.length > 0 ? form.goals : null,
    }
    if (editingRev) {
      const { error } = await supabase.from('performance_reviews').update(payload).eq('id', editingRev.id)
      if (error) { toast.error('Erro ao atualizar'); return }
      toast.success('Avaliação atualizada!')
    } else {
      const { error } = await supabase.from('performance_reviews').insert(payload)
      if (error) { toast.error('Erro ao criar avaliação'); return }
      toast.success('Avaliação criada!')
    }
    setDialog(false)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta avaliação?')) return
    const supabase = createClient()
    await supabase.from('performance_reviews').delete().eq('id', id)
    toast.success('Avaliação excluída')
    load()
  }

  const getEmpName = (id: string) => employees.find(e => e.id === id)?.full_name ?? '—'

  const avgScore = reviews.filter(r => r.score !== null).length > 0
    ? (reviews.filter(r => r.score !== null).reduce((s, r) => s + (r.score ?? 0), 0) /
       reviews.filter(r => r.score !== null).length).toFixed(1)
    : '—'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Avaliação de Desempenho</h1>
          <p className="text-gray-500 mt-1">Avaliações periódicas e acompanhamento de metas</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Nova avaliação</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total de avaliações', value: reviews.length,                                       color: 'text-blue-600',  bg: 'bg-blue-50' },
          { label: 'Concluídas',          value: reviews.filter(r => r.status === 'acknowledged').length, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Nota média',          value: avgScore,                                              color: 'text-yellow-600',bg: 'bg-yellow-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4`}>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-sm text-gray-600 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-gray-400 bg-white rounded-xl border">Carregando...</div>
        ) : reviews.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
            <Star className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Nenhuma avaliação registrada</p>
          </div>
        ) : (
          reviews.map(rev => {
            const s = STATUS_MAP[rev.status]
            const goalsTotal    = rev.goals?.length ?? 0
            const goalsAchieved = rev.goals?.filter(g => g.achieved).length ?? 0
            return (
              <div key={rev.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{getEmpName(rev.employee_id)}</p>
                    <Badge variant={s.variant}>{s.label}</Badge>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                      {REVIEW_TYPE_LABELS[rev.review_type ?? 'manager']}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">Período: {rev.period}</p>
                  <div className="flex items-center gap-4 mt-1">
                    <ScoreStars score={rev.score} />
                    {goalsTotal > 0 && (
                      <span className="text-xs text-gray-400">
                        Metas: {goalsAchieved}/{goalsTotal} concluídas
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setDetailRev(rev)}
                    className="text-xs px-2 py-1 rounded hover:bg-gray-100 text-gray-500"
                  >
                    Ver
                  </button>
                  <button onClick={() => openEdit(rev)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(rev.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Dialog criar/editar */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRev ? 'Editar avaliação' : 'Nova avaliação'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Colaborador *</Label>
                <Select
                  defaultValue={form.employee_id || undefined}
                  onValueChange={(v) => setForm(f => ({ ...f, employee_id: v ?? '' }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Período *</Label>
                <Input placeholder="Ex: 2024-T1 ou 2024" value={form.period}
                  onChange={e => setForm(f => ({ ...f, period: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de avaliação</Label>
                <Select
                  defaultValue={form.review_type}
                  onValueChange={(v) => setForm(f => ({ ...f, review_type: (v ?? 'manager') as ReviewForm['review_type'] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(REVIEW_TYPE_LABELS).map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nota (1–5)</Label>
                <Select
                  defaultValue={form.score || undefined}
                  onValueChange={(v) => setForm(f => ({ ...f, score: v ?? '' }))}
                >
                  <SelectTrigger><SelectValue placeholder="Sem nota" /></SelectTrigger>
                  <SelectContent>
                    {['1','2','3','4','5'].map(n => <SelectItem key={n} value={n}>{n} estrela{n !== '1' ? 's' : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  defaultValue={form.status}
                  onValueChange={(v) => setForm(f => ({ ...f, status: (v ?? 'draft') as ReviewStatus }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_MAP).map(([v, { label }]) => (
                      <SelectItem key={v} value={v}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Feedback</Label>
              <Textarea rows={3} placeholder="Feedback sobre o desempenho..." value={form.feedback}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm(f => ({ ...f, feedback: e.target.value }))} />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Metas</Label>
              <div className="flex gap-2">
                <Input placeholder="Descreva uma meta..." value={newGoal}
                  onChange={e => setNewGoal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGoal() } }} />
                <Button type="button" variant="outline" onClick={addGoal}>Adicionar</Button>
              </div>
              {form.goals.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {form.goals.map((g, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100">
                      <button type="button" onClick={() => toggleGoal(idx)}>
                        {g.achieved
                          ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                          : <Circle className="h-4 w-4 text-gray-300" />
                        }
                      </button>
                      <span className={`flex-1 text-sm ${g.achieved ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                        {g.title}
                      </span>
                      <button type="button" onClick={() => removeGoal(idx)} className="text-gray-300 hover:text-red-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog detalhe */}
      <Dialog open={!!detailRev} onOpenChange={(o) => { if (!o) setDetailRev(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes da avaliação</DialogTitle>
          </DialogHeader>
          {detailRev && (
            <div className="space-y-4 pt-2 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 text-base">{getEmpName(detailRev.employee_id)}</p>
                  <p className="text-gray-500">Período: {detailRev.period}</p>
                </div>
                <Badge variant={STATUS_MAP[detailRev.status].variant}>{STATUS_MAP[detailRev.status].label}</Badge>
              </div>
              <ScoreStars score={detailRev.score} />
              {detailRev.feedback && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Feedback</p>
                    <p className="text-gray-700">{detailRev.feedback}</p>
                  </div>
                </>
              )}
              {detailRev.goals && detailRev.goals.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Metas</p>
                    <div className="space-y-1.5">
                      {detailRev.goals.map((g, i) => (
                        <div key={i} className="flex items-center gap-2">
                          {g.achieved
                            ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            : <Circle className="h-4 w-4 text-gray-300 shrink-0" />
                          }
                          <span className={g.achieved ? 'line-through text-gray-400' : 'text-gray-700'}>{g.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <p className="text-xs text-gray-400">{formatDate(detailRev.created_at)}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
