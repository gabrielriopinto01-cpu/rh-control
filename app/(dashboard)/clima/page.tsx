'use client'

import { useEffect, useState, useCallback } from 'react'
import { Smile, Plus, Trash2, Loader2, BarChart3, X, Send, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useMyEmployee } from '@/hooks/use-my-employee'
import type { ClimateSurvey, ClimateResponse, ClimateQuestion } from '@/types/database'

export const dynamic = 'force-dynamic'

const SCALE = [1, 2, 3, 4, 5]
const SCALE_EMOJI = ['😠', '🙁', '😐', '🙂', '😄']

export default function ClimaPage() {
  const { user } = useAuth()
  const { employee } = useMyEmployee()
  const isManager = user?.role === 'adm_total' || user?.role === 'rh' || user?.role === 'gestor'

  const [surveys,   setSurveys]   = useState<ClimateSurvey[]>([])
  const [responses, setResponses] = useState<ClimateResponse[]>([])
  const [loading,   setLoading]   = useState(true)

  // criação
  const [createOpen, setCreateOpen] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [title,      setTitle]      = useState('')
  const [description,setDescription]= useState('')
  const [questions,  setQuestions]  = useState<string[]>([''])

  // resposta
  const [answering, setAnswering] = useState<ClimateSurvey | null>(null)
  const [answers,   setAnswers]   = useState<Record<string, number>>({})
  const [comment,   setComment]   = useState('')
  const [sending,   setSending]   = useState(false)

  // resultados
  const [results, setResults] = useState<ClimateSurvey | null>(null)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const supabase = createClient()
    const [sRes, rRes] = await Promise.all([
      supabase.from('climate_surveys').select('*').eq('company_id', user.company_id).order('created_at', { ascending: false }),
      supabase.from('climate_responses').select('*').eq('company_id', user.company_id),
    ])
    setSurveys((sRes.data as ClimateSurvey[]) ?? [])
    setResponses((rRes.data as ClimateResponse[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const answeredByMe = (surveyId: string) =>
    employee ? responses.some(r => r.survey_id === surveyId && r.employee_id === employee.id) : false

  const responsesOf = (surveyId: string) => responses.filter(r => r.survey_id === surveyId)

  // ── Criar pesquisa ──
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured() || !user) return
    const qs: ClimateQuestion[] = questions.filter(q => q.trim()).map((q, i) => ({ id: `q${i + 1}`, text: q.trim() }))
    if (!title.trim() || qs.length === 0) { toast.error('Informe título e ao menos uma pergunta'); return }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('climate_surveys').insert({
      company_id: user.company_id, title: title.trim(), description: description.trim() || null,
      questions: qs, created_by: user.id,
    })
    setSaving(false)
    if (error) { toast.error('Erro ao criar pesquisa'); return }
    toast.success('Pesquisa criada!')
    setCreateOpen(false); setTitle(''); setDescription(''); setQuestions([''])
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta pesquisa e suas respostas?')) return
    const supabase = createClient()
    const { error } = await supabase.from('climate_surveys').delete().eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Pesquisa excluída'); load()
  }

  // ── Responder ──
  const openAnswer = (s: ClimateSurvey) => { setAnswering(s); setAnswers({}); setComment('') }
  const submitAnswer = async () => {
    if (!isSupabaseConfigured() || !user || !answering) return
    if (Object.keys(answers).length < answering.questions.length) { toast.error('Responda todas as perguntas'); return }
    setSending(true)
    const supabase = createClient()
    const { error } = await supabase.from('climate_responses').insert({
      survey_id: answering.id, company_id: user.company_id,
      employee_id: employee?.id ?? null, answers, comment: comment.trim() || null,
    })
    setSending(false)
    if (error) { toast.error('Erro ao enviar resposta'); return }
    toast.success('Resposta enviada. Obrigado! 🙌')
    setAnswering(null); load()
  }

  // ── Médias dos resultados ──
  const computeAverages = (s: ClimateSurvey) => {
    const rs = responsesOf(s.id)
    return s.questions.map(q => {
      const vals = rs.map(r => r.answers[q.id]).filter(v => typeof v === 'number')
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
      return { q, avg, count: vals.length }
    })
  }
  const overallAvg = (s: ClimateSurvey) => {
    const avgs = computeAverages(s).map(a => a.avg).filter(a => a > 0)
    return avgs.length ? (avgs.reduce((a, b) => a + b, 0) / avgs.length) : 0
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Carregando...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pesquisa de Clima</h1>
          <p className="text-gray-500 mt-1">Satisfação, engajamento e ambiente organizacional</p>
        </div>
        {isManager && (
          <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" /> Nova pesquisa</Button>
        )}
      </div>

      {surveys.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Smile className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Nenhuma pesquisa no momento</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {surveys.map(s => {
            const rs = responsesOf(s.id)
            const answered = answeredByMe(s.id)
            return (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-gray-900">{s.title}</h3>
                  {isManager && (
                    <button onClick={() => handleDelete(s.id)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
                {s.description && <p className="text-sm text-gray-500 mt-1">{s.description}</p>}
                <p className="text-xs text-gray-400 mt-2">{s.questions.length} pergunta(s) · {rs.length} resposta(s)</p>
                <div className="flex gap-2 mt-4">
                  {employee && (
                    answered
                      ? <span className="flex items-center gap-1 text-sm text-green-600"><CheckCircle2 className="h-4 w-4" /> Respondida</span>
                      : <Button size="sm" onClick={() => openAnswer(s)}>Responder</Button>
                  )}
                  {isManager && (
                    <Button size="sm" variant="outline" onClick={() => setResults(s)}>
                      <BarChart3 className="h-4 w-4 mr-1.5" /> Resultados
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Criar pesquisa */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova pesquisa de clima</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Clima organizacional 2026" />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Perguntas (escala 1 a 5)</Label>
              {questions.map((q, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={q} onChange={e => setQuestions(qs => qs.map((x, j) => j === i ? e.target.value : x))}
                    placeholder={`Pergunta ${i + 1}`} />
                  {questions.length > 1 && (
                    <button type="button" onClick={() => setQuestions(qs => qs.filter((_, j) => j !== i))}
                      className="text-gray-400 hover:text-red-500"><X className="h-4 w-4" /></button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setQuestions(qs => [...qs, ''])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar pergunta
              </Button>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Criar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Responder */}
      <Dialog open={!!answering} onOpenChange={(o) => { if (!o) setAnswering(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{answering?.title}</DialogTitle></DialogHeader>
          {answering && (
            <div className="space-y-5 pt-1">
              {answering.questions.map(q => (
                <div key={q.id}>
                  <p className="text-sm font-medium text-gray-800 mb-2">{q.text}</p>
                  <div className="flex justify-between gap-1">
                    {SCALE.map((n, i) => (
                      <button key={n} type="button" onClick={() => setAnswers(a => ({ ...a, [q.id]: n }))}
                        className={`flex-1 py-2 rounded-lg border text-xl transition-colors ${
                          answers[q.id] === n ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                        {SCALE_EMOJI[i]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="space-y-1.5">
                <Label>Comentário (opcional)</Label>
                <Textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} />
              </div>
              <Button onClick={submitAnswer} disabled={sending} className="w-full">
                {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar resposta
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Resultados */}
      <Dialog open={!!results} onOpenChange={(o) => { if (!o) setResults(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Resultados — {results?.title}</DialogTitle></DialogHeader>
          {results && (
            <div className="space-y-4 pt-1">
              <div className="bg-indigo-50 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-indigo-700">Satisfação geral</p>
                  <p className="text-3xl font-bold text-indigo-900">{overallAvg(results).toFixed(1)}<span className="text-base font-normal text-indigo-400">/5</span></p>
                </div>
                <p className="text-sm text-indigo-600">{responsesOf(results.id).length} resposta(s)</p>
              </div>
              <div className="space-y-3">
                {computeAverages(results).map(({ q, avg, count }) => (
                  <div key={q.id}>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">{q.text}</span>
                      <span className="font-semibold text-gray-900">{avg.toFixed(1)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(avg / 5) * 100}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{count} resposta(s)</p>
                  </div>
                ))}
              </div>
              {responsesOf(results.id).some(r => r.comment) && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Comentários</p>
                  {responsesOf(results.id).filter(r => r.comment).map(r => (
                    <p key={r.id} className="text-sm text-gray-500 bg-gray-50 rounded-lg p-2">“{r.comment}”</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
