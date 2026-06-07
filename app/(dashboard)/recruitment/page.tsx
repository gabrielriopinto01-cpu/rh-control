'use client'

import { useEffect, useState, useCallback } from 'react'
import { Briefcase, Users, Plus, ChevronRight, ChevronDown, Search, Pencil, Trash2 } from 'lucide-react'
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
import type { JobOpening, Candidate, JobStatus, CandidateStage } from '@/types/database'

export const dynamic = 'force-dynamic'

const JOB_STATUS: Record<JobStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  open:   { label: 'Aberta',    variant: 'default' },
  paused: { label: 'Pausada',   variant: 'secondary' },
  closed: { label: 'Encerrada', variant: 'outline' },
}

const STAGES: Record<CandidateStage, { label: string; color: string }> = {
  applied:   { label: 'Candidato',  color: 'bg-gray-100 text-gray-700' },
  screening: { label: 'Triagem',    color: 'bg-blue-100 text-blue-700' },
  interview: { label: 'Entrevista', color: 'bg-purple-100 text-purple-700' },
  offer:     { label: 'Proposta',   color: 'bg-yellow-100 text-yellow-700' },
  hired:     { label: 'Contratado', color: 'bg-green-100 text-green-700' },
  rejected:  { label: 'Reprovado',  color: 'bg-red-100 text-red-700' },
}

type JobForm = { title: string; description: string; requirements: string; status: JobStatus; open_date: string; close_date: string }
type CandidateForm = { name: string; email: string; phone: string; stage: CandidateStage; notes: string }

export default function RecruitmentPage() {
  const { user } = useAuth()

  const [jobs,       setJobs]       = useState<JobOpening[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [expandedJob, setExpandedJob] = useState<string | null>(null)

  const [jobDialog,  setJobDialog]  = useState(false)
  const [editingJob, setEditingJob] = useState<JobOpening | null>(null)

  const [candDialog,  setCandDialog]  = useState(false)
  const [candJob,     setCandJob]     = useState<string | null>(null)
  const [editingCand, setEditingCand] = useState<Candidate | null>(null)

  const blankJob = (): JobForm => ({
    title: '', description: '', requirements: '', status: 'open',
    open_date: new Date().toISOString().slice(0, 10), close_date: '',
  })
  const blankCand = (): CandidateForm => ({ name: '', email: '', phone: '', stage: 'applied', notes: '' })

  const [jobForm,  setJobForm]  = useState<JobForm>(blankJob)
  const [candForm, setCandForm] = useState<CandidateForm>(blankCand)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const supabase = createClient()
    const [j, c] = await Promise.all([
      supabase.from('job_openings').select('*').eq('company_id', user.company_id).order('created_at', { ascending: false }),
      supabase.from('candidates').select('*').order('created_at', { ascending: false }),
    ])
    setJobs(j.data ?? [])
    setCandidates(c.data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // ─── Vagas ───────────────────────────────────────────────────────
  const openCreateJob = () => { setEditingJob(null); setJobForm(blankJob()); setJobDialog(true) }
  const openEditJob = (job: JobOpening) => {
    setEditingJob(job)
    setJobForm({ title: job.title, description: job.description ?? '', requirements: job.requirements ?? '',
      status: job.status, open_date: job.open_date, close_date: job.close_date ?? '' })
    setJobDialog(true)
  }

  const handleJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured() || !user) return
    if (!jobForm.title) { toast.error('Título obrigatório'); return }
    const supabase = createClient()
    const payload = {
      company_id: user.company_id, title: jobForm.title,
      description: jobForm.description || null, requirements: jobForm.requirements || null,
      status: jobForm.status, open_date: jobForm.open_date, close_date: jobForm.close_date || null,
    }
    if (editingJob) {
      const { error } = await supabase.from('job_openings').update(payload).eq('id', editingJob.id)
      if (error) { toast.error('Erro ao atualizar'); return }
      toast.success('Vaga atualizada!')
    } else {
      const { error } = await supabase.from('job_openings').insert(payload)
      if (error) { toast.error('Erro ao criar'); return }
      toast.success('Vaga criada!')
    }
    setJobDialog(false)
    load()
  }

  const handleJobDelete = async (id: string) => {
    if (!confirm('Excluir esta vaga?')) return
    const supabase = createClient()
    await supabase.from('job_openings').delete().eq('id', id)
    toast.success('Vaga excluída')
    load()
  }

  // ─── Candidatos ──────────────────────────────────────────────────
  const openCreateCand = (jobId: string) => {
    setEditingCand(null); setCandJob(jobId); setCandForm(blankCand()); setCandDialog(true)
  }
  const openEditCand = (c: Candidate) => {
    setEditingCand(c); setCandJob(c.job_opening_id)
    setCandForm({ name: c.name, email: c.email, phone: c.phone ?? '', stage: c.stage, notes: c.notes ?? '' })
    setCandDialog(true)
  }

  const handleCandSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!candJob) return
    if (!candForm.name || !candForm.email) { toast.error('Nome e e-mail obrigatórios'); return }
    const supabase = createClient()
    const payload = {
      job_opening_id: candJob, name: candForm.name, email: candForm.email,
      phone: candForm.phone || null, stage: candForm.stage, notes: candForm.notes || null,
    }
    if (editingCand) {
      const { error } = await supabase.from('candidates').update(payload).eq('id', editingCand.id)
      if (error) { toast.error('Erro ao atualizar'); return }
      toast.success('Candidato atualizado!')
    } else {
      const { error } = await supabase.from('candidates').insert(payload)
      if (error) { toast.error('Erro ao cadastrar'); return }
      toast.success('Candidato cadastrado!')
    }
    setCandDialog(false)
    load()
  }

  const handleCandDelete = async (id: string) => {
    if (!confirm('Excluir este candidato?')) return
    const supabase = createClient()
    await supabase.from('candidates').delete().eq('id', id)
    toast.success('Candidato excluído')
    load()
  }

  const updateStage = async (id: string, stage: CandidateStage) => {
    const supabase = createClient()
    await supabase.from('candidates').update({ stage }).eq('id', id)
    load()
  }

  const filtered = jobs.filter(j =>
    j.title.toLowerCase().includes(search.toLowerCase())
  )

  const jobCandidates = (jobId: string) => candidates.filter(c => c.job_opening_id === jobId)

  const stats = {
    open:        jobs.filter(j => j.status === 'open').length,
    candidates:  candidates.length,
    hired:       candidates.filter(c => c.stage === 'hired').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recrutamento</h1>
          <p className="text-gray-500 mt-1">Vagas abertas e candidatos</p>
        </div>
        <Button onClick={openCreateJob}><Plus className="h-4 w-4 mr-2" />Nova vaga</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {([
          { label: 'Vagas abertas',  value: stats.open,       Icon: Briefcase, color: 'text-blue-600',  bg: 'bg-blue-50' },
          { label: 'Candidatos',     value: stats.candidates, Icon: Users,     color: 'text-purple-600',bg: 'bg-purple-50' },
          { label: 'Contratados',    value: stats.hired,      Icon: Briefcase, color: 'text-green-600', bg: 'bg-green-50' },
        ] as const).map(({ label, value, Icon, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4 flex items-center gap-3`}>
            <Icon className={`h-8 w-8 ${color}`} />
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-sm text-gray-600">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input className="pl-9" placeholder="Buscar vaga..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Lista de vagas */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-gray-400 bg-white rounded-xl border">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
            <Briefcase className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Nenhuma vaga cadastrada</p>
          </div>
        ) : (
          filtered.map(job => {
            const cands    = jobCandidates(job.id)
            const expanded = expandedJob === job.id
            const s        = JOB_STATUS[job.status]
            return (
              <div key={job.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Cabeçalho vaga */}
                <div className="p-4 flex items-center justify-between gap-4">
                  <button
                    onClick={() => setExpandedJob(expanded ? null : job.id)}
                    className="flex items-center gap-3 text-left flex-1 min-w-0"
                  >
                    {expanded ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{job.title}</p>
                      <p className="text-xs text-gray-400">
                        Aberta em {formatDate(job.open_date)} · {cands.length} candidato{cands.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={s.variant}>{s.label}</Badge>
                    <button onClick={() => openEditJob(job)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleJobDelete(job.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Candidatos expandidos */}
                {expanded && (
                  <div className="border-t border-gray-100">
                    {job.description && (
                      <p className="px-5 py-3 text-sm text-gray-600 border-b border-gray-100 bg-gray-50">{job.description}</p>
                    )}
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Candidatos</p>
                        <Button size="sm" variant="outline" onClick={() => openCreateCand(job.id)}>
                          <Plus className="h-3 w-3 mr-1" />Adicionar
                        </Button>
                      </div>
                      {cands.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">Nenhum candidato ainda</p>
                      ) : (
                        <div className="space-y-2">
                          {cands.map(c => {
                            const st = STAGES[c.stage]
                            return (
                              <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                                  <p className="text-xs text-gray-500">{c.email}{c.phone ? ` · ${c.phone}` : ''}</p>
                                </div>
                                <Select
                                  defaultValue={c.stage}
                                  onValueChange={(v) => v && updateStage(c.id, v as CandidateStage)}
                                >
                                  <SelectTrigger className="w-36 h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(STAGES).map(([v, { label }]) => (
                                      <SelectItem key={v} value={v}>{label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <button onClick={() => openEditCand(c)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => handleCandDelete(c.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Dialog vaga */}
      <Dialog open={jobDialog} onOpenChange={setJobDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingJob ? 'Editar vaga' : 'Nova vaga'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleJobSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Título da vaga *</Label>
              <Input placeholder="Ex: Desenvolvedor Full Stack" value={jobForm.title}
                onChange={e => setJobForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select defaultValue={jobForm.status}
                  onValueChange={(v) => setJobForm(f => ({ ...f, status: (v ?? 'open') as JobStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(JOB_STATUS).map(([v, { label }]) => (
                      <SelectItem key={v} value={v}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Data abertura *</Label>
                <Input type="date" value={jobForm.open_date}
                  onChange={e => setJobForm(f => ({ ...f, open_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea rows={3} placeholder="Descreva a vaga..." value={jobForm.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setJobForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Requisitos</Label>
              <Textarea rows={3} placeholder="Requisitos necessários..." value={jobForm.requirements}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setJobForm(f => ({ ...f, requirements: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setJobDialog(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog candidato */}
      <Dialog open={candDialog} onOpenChange={setCandDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCand ? 'Editar candidato' : 'Adicionar candidato'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCandSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="Nome completo" value={candForm.name}
                onChange={e => setCandForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>E-mail *</Label>
                <Input type="email" placeholder="email@exemplo.com" value={candForm.email}
                  onChange={e => setCandForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input placeholder="(11) 99999-9999" value={candForm.phone}
                  onChange={e => setCandForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Etapa</Label>
              <Select defaultValue={candForm.stage}
                onValueChange={(v) => setCandForm(f => ({ ...f, stage: (v ?? 'applied') as CandidateStage }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STAGES).map(([v, { label }]) => (
                    <SelectItem key={v} value={v}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea rows={2} placeholder="Notas sobre o candidato..." value={candForm.notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCandForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setCandDialog(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
