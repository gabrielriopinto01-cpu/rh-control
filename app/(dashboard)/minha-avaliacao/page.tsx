'use client'

import { useEffect, useState, useCallback } from 'react'
import { Star, Plus, Loader2, AlertCircle, Target } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useMyEmployee } from '@/hooks/use-my-employee'
import type { PerformanceReview } from '@/types/database'

export const dynamic = 'force-dynamic'

const TYPE_LABELS: Record<string, string> = {
  manager: 'Avaliação do gestor', self: 'Autoavaliação', peer: 'Avaliação 360°',
}

function Stars({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400 text-sm">Sem nota</span>
  return (
    <span className="inline-flex items-center">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`h-4 w-4 ${i <= score ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
      ))}
    </span>
  )
}

export default function MinhaAvaliacaoPage() {
  const { user } = useAuth()
  const { employee, loading: empLoading } = useMyEmployee()
  const [reviews, setReviews] = useState<PerformanceReview[]>([])
  const [loading, setLoading] = useState(true)
  const [dialog,  setDialog]  = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [form, setForm] = useState({ period: '', score: '', feedback: '' })

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user || !employee) { setLoading(false); return }
    const supabase = createClient()
    const { data } = await supabase.from('performance_reviews').select('*')
      .eq('employee_id', employee.id).order('created_at', { ascending: false })
    setReviews((data as PerformanceReview[]) ?? [])
    setLoading(false)
  }, [user, employee])

  useEffect(() => { load() }, [load])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured() || !user || !employee) return
    if (!form.period.trim()) { toast.error('Informe o período'); return }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('performance_reviews').insert({
      company_id: user.company_id, employee_id: employee.id, reviewer_id: user.id,
      period: form.period.trim(), score: form.score ? Number(form.score) : null,
      feedback: form.feedback || null, status: 'submitted', review_type: 'self',
    })
    setSaving(false)
    if (error) { toast.error('Erro ao enviar autoavaliação'); return }
    toast.success('Autoavaliação enviada!')
    setForm({ period: '', score: '', feedback: '' }); setDialog(false)
    load()
  }

  if (empLoading || loading) return <div className="p-8 text-center text-gray-400">Carregando...</div>
  if (!employee) return (
    <div className="p-12 text-center">
      <AlertCircle className="h-10 w-10 text-yellow-400 mx-auto mb-3" />
      <p className="font-semibold text-gray-700">Seu usuário não está vinculado a um colaborador</p>
    </div>
  )

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Minha Avaliação</h1>
          <p className="text-gray-500 mt-1">Suas avaliações de desempenho e autoavaliações</p>
        </div>
        <Button onClick={() => setDialog(true)}><Plus className="h-4 w-4 mr-2" /> Nova autoavaliação</Button>
      </div>

      {reviews.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Target className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Nenhuma avaliação ainda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-gray-900">Período: {r.period}</p>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{TYPE_LABELS[r.review_type ?? 'manager']}</span>
              </div>
              <div className="mt-1"><Stars score={r.score} /></div>
              {r.feedback && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{r.feedback}</p>}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova autoavaliação</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Período *</Label>
              <Input placeholder="Ex: 2026-T2 ou 2026" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Como você avalia seu desempenho? (1–5)</Label>
              <Select value={form.score} onValueChange={(v) => setForm(f => ({ ...f, score: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {['1','2','3','4','5'].map(n => <SelectItem key={n} value={n}>{n} estrela{n !== '1' ? 's' : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Comentário / reflexão</Label>
              <Textarea rows={4} value={form.feedback} onChange={e => setForm(f => ({ ...f, feedback: e.target.value }))}
                placeholder="Pontos fortes, conquistas, o que pode melhorar..." />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enviar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
