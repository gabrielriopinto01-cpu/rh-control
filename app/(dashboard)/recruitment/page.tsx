'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Briefcase, Users, Plus, ChevronRight, ChevronDown, Search, Pencil, Trash2, Kanban, List, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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

const STAGES: Record<CandidateStage, { label: string; color: string; header: string }> = {
  applied:   { label: 'Candidato',  color: 'bg-gray-100 text-gray-700',     header: 'bg-gray-200' },
  screening: { label: 'Triagem',    color: 'bg-blue-100 text-blue-700',     header: 'bg-blue-200' },
  interview: { label: 'Entrevista', color: 'bg-purple-100 text-purple-700', header: 'bg-purple-200' },
  offer:     { label: 'Proposta',   color: 'bg-yellow-100 text-yellow-700', header: 'bg-yellow-200' },
  hired:     { label: 'Contratado', color: 'bg-green-100 text-green-700',   header: 'bg-green-200' },
  rejected:  { label: 'Reprovado',  color: 'bg-red-100 text-red-700',       header: 'bg-red-200' },
}

const STAGE_ORDER: CandidateStage[] = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected']

type JobForm  = { title: string; description: string; requirements: string; status: JobStatus; open_date: string; close_date: string }
type CandForm = { name: string; email: string; phone: string; stage: CandidateStage; notes: string }

// ─── Kanban column ──────────────────────────────────────────────
function KanbanCol({
  stage, candidates, onDrop, onEdit, onDelete,
}: {
  stage: CandidateStage
  candidates: Candidate[]
  onDrop: (candidateId: string, stage: CandidateStage) => void
  onEdit: (c: Candidate) => void
  onDelete: (id: string) => void
}) {
  const { label, header } = STAGES[stage]
  const [over, setOver] = useState(false)

  return (
    <div
      className={`flex-1 min-w-[160px] max-w-[220px] rounded-xl border ${over ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200 bg-muted/30'} transition-colors`}
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault(); setOver(false)
        const id = e.dataTransfer.getData('candidate_id')
        if (id) onDrop(id, stage)
      }}
    >
      <div className={`${header} rounded-t-xl px-3 py-2 flex items-center justify-between`}>
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
        <span className="text-xs bg-white/70 rounded-full px-1.5 py-0.5 font-bold">{candidates.length}</span>
      </div>
      <div className="p-2 space-y-2 min-h-[120px]">
        {candidates.map(c => (
          <div
            key={c.id}
            draggable
            onDragStart={e => e.dataTransfer.setData('candidate_id', c.id)}
            className="bg-white rounded-lg border border-gray-200 p-2.5 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
          >
            <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
            <p className="text-xs text-gray-500 truncate">{c.email}</p>
            <div className="flex items-center gap-1 mt-1.5">
              <button onClick={() => onEdit(c)} className="p-0.5 rounded text-gray-400 hover:text-blue-500">
                <Pencil className="h-3 w-3" />
              </button>
              <button onClick={() => onDelete(c.id)} className="p-0.5 rounded text-gray-400 hover:text-red-500">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function RecruitmentPage() {
  const { user } = useAuth()

  const [jobs,        setJobs]        = useState<JobOpening[]>([])
  const [candidates,  setCandidates]  = useState<Candidate[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const [view,        setView]        = useState<'list' | 'kanban'>('list')
  const [kanbanJob,   setKanbanJob]   = useState<string | null>(null)

  const [jobDialog,  setJobDialog]  = useState(false)
  const [editingJob, setEditingJob] = useState<JobOpening | null>(null)

  const [candDialog,  setCandDialog]  = useState(false)
  const [candJob,     setCandJob]     = useState<string | null>(null)
  const [editingCand, setEditingCand] = useState<Candidate | null>(null)

  const blankJob  = (): JobForm  => ({ title: '', description: '', requirements: '', status: 'open', open_date: new Date().toISOString().slice(0,10), close_date: '' })
  const blankCand = (): CandForm => ({ name: '', email: '', phone: '', stage: 'applied', notes: '' })

  const [jobForm,  setJobForm]  = useState<JobForm>(blankJob)
  const [candForm, setCandForm] = useState<CandForm>(blankCand)

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

  // ─── Vagas ──────────────────────────────────────────────────────
  const openCreateJob = () => { setEditingJob(null); setJobForm(blankJob()); setJobDialog(true) }
  const openEditJob   = (job: JobOpening) => {
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
    const payload  = { company_id: user.company_id, title: jobForm.title, description: jobForm.description || null,
      requirements: jobForm.requirements || null, status: jobForm.status, open_date: jobForm.open_date, close_date: jobForm.close_date || null }
    if (editingJob) {
      const { error } = await supabase.from('job_openings').update(payload).eq('id', editingJob.id)
      if (error) { toast.error('Erro ao atualizar'); return }
      toast.success('Vaga atualizada!')
    } else {
      const { error } = await supabase.from('job_openings').insert(payload)
      if (error) { toast.error('Erro ao criar'); return }
      toast.success('Vaga criada!')
    }
    setJobDialog(false); load()
  }

  const handleJobDelete = async (id: string) => {
    if (!confirm('Excluir esta vaga?')) return
    await createClient().from('job_openings').delete().eq('id', id)
    toast.success('Vaga excluída'); load()
  }

  // ─── Candidatos ─────────────────────────────────────────────────
  const openCreateCand = (jobId: string) => { setEditingCand(null); setCandJob(jobId); setCandForm(blankCand()); setCandDialog(true) }
  const openEditCand   = (c: Candidate) => {
    setEditingCand(c); setCandJob(c.job_opening_id)
    setCandForm({ name: c.name, email: c.email, phone: c.phone ?? '', stage: c.stage, notes: c.notes ?? '' })
    setCandDialog(true)
  }

  const handleCandSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!candJob) return
    if (!candForm.name || !candForm.email) { toast.error('Nome e e-mail obrigatórios'); return }
    const supabase = createClient()
    const payload  = { job_opening_id: candJob, name: candForm.name, email: candForm.email,
      phone: candForm.phone || null, stage: candForm.stage, notes: candForm.notes || null }
    if (editingCand) {
      const { error } = await supabase.from('candidates').update(payload).eq('id', editingCand.id)
      if (error) { toast.error('Erro ao atualizar'); return }
      toast.success('Candidato atualizado!')
    } else {
      const { error } = await supabase.from('candidates').insert(payload)
      if (error) { toast.error('Erro ao cadastrar'); return }
      toast.success('Candidato cadastrado!')
    }
    setCandDialog(false); load()
  }

  const handleCandDelete = async (id: string) => {
    if (!confirm('Excluir este candidato?')) return
    await createClient().from('candidates').delete().eq('id', id)
    toast.success('Candidato excluído'); load()
  }

  const updateStage = async (id: string, stage: CandidateStage) => {
    await createClient().from('candidates').update({ stage }).eq('id', id)
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, stage } : c))
  }

  const filtered       = jobs.filter(j => j.title.toLowerCase().includes(search.toLowerCase()))
  const jobCandidates  = (jobId: string) => candidates.filter(c => c.job_opening_id === jobId)
  const kanbanCandidates = kanbanJob ? candidates.filter(c => c.job_opening_id === kanbanJob) : candidates

  const stats = {
    open:       jobs.filter(j => j.status === 'open').length,
    candidates: candidates.length,
    hired:      candidates.filter(c => c.stage === 'hired').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recrutamento</h1>
          <p className="text-muted-foreground mt-1">Vagas abertas e candidatos</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 flex items-center gap-1.5 text-sm ${view === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              <List className="h-4 w-4" /> Lista
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`px-3 py-1.5 flex items-center gap-1.5 text-sm ${view === 'kanban' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              <Kanban className="h-4 w-4" /> Kanban
            </button>
          </div>
          {user?.company_id && (
            <a href={`/careers/${user.company_id}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline"><ExternalLink className="h-4 w-4 mr-2" />Portal de vagas</Button>
            </a>
          )}
          <Button onClick={openCreateJob}><Plus className="h-4 w-4 mr-2" />Nova vaga</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {([
          { label: 'Vagas abertas',  value: stats.open,       Icon: Briefcase, color: 'text-blue-600',   bg: 'bg-blue-50'   },
          { label: 'Candidatos',     value: stats.candidates, Icon: Users,     color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Contratados',    value: stats.hired,      Icon: Briefcase, color: 'text-green-600',  bg: 'bg-green-50'  },
        ] as const).map(({ label, value, Icon, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4 flex items-center gap-3`}>
            <Icon className={`h-8 w-8 ${color}`} />
            <div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar vaga..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* ═══ VIEW: LISTA ══════════════════════════════════════════ */}
      {view === 'list' && (
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground bg-card rounded-xl border">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center bg-card rounded-xl border border-dashed">
              <Briefcase className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">Nenhuma vaga cadastrada</p>
            </div>
          ) : (
            filtered.map(job => {
              const cands    = jobCandidates(job.id)
              const expanded = expandedJob === job.id
              const s        = JOB_STATUS[job.status]
              return (
                <div key={job.id} className="bg-card rounded-xl border overflow-hidden">
                  <div className="p-4 flex items-center justify-between gap-4">
                    <button onClick={() => setExpandedJob(expanded ? null : job.id)} className="flex items-center gap-3 text-left flex-1 min-w-0">
                      {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{job.title}</p>
                        <p className="text-xs text-muted-foreground">Aberta em {formatDate(job.open_date)} · {cands.length} candidato{cands.length !== 1 ? 's' : ''}</p>
                      </div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={s.variant}>{s.label}</Badge>
                      <button
                        onClick={() => { setView('kanban'); setKanbanJob(job.id) }}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Ver no Kanban"
                      >
                        <Kanban className="h-4 w-4" />
                      </button>
                      <button onClick={() => openEditJob(job)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleJobDelete(job.id)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t">
                      {job.description && <p className="px-5 py-3 text-sm text-muted-foreground border-b bg-muted/30">{job.description}</p>}
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Candidatos</p>
                          <Button size="sm" variant="outline" onClick={() => openCreateCand(job.id)}>
                            <Plus className="h-3 w-3 mr-1" />Adicionar
                          </Button>
                        </div>
                        {cands.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">Nenhum candidato ainda</p>
                        ) : (
                          <div className="space-y-2">
                            {cands.map(c => {
                              const st = STAGES[c.stage]
                              return (
                                <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm">{c.name}</p>
                                    <p className="text-xs text-muted-foreground">{c.email}{c.phone ? ` · ${c.phone}` : ''}</p>
                                  </div>
                                  <Select defaultValue={c.stage} onValueChange={(v) => v && updateStage(c.id, v as CandidateStage)}>
                                    <SelectTrigger className="w-36 h-7 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(STAGES).map(([v, { label }]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  <button onClick={() => openEditCand(c)} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                                  <button onClick={() => handleCandDelete(c.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
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
      )}

      {/* ═══ VIEW: KANBAN ═════════════════════════════════════════ */}
      {view === 'kanban' && (
        <div className="space-y-4">
          {/* Seletor de vaga */}
          <div className="flex items-center gap-3">
            <select
              value={kanbanJob ?? ''}
              onChange={e => setKanbanJob(e.target.value || null)}
              className="border rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="">Todos os candidatos</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
            {kanbanJob && (
              <Button size="sm" variant="outline" onClick={() => openCreateCand(kanbanJob)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Candidato
              </Button>
            )}
          </div>

          {/* Colunas */}
          <div className="flex gap-3 overflow-x-auto pb-4">
            {STAGE_ORDER.map(stage => (
              <KanbanCol
                key={stage}
                stage={stage}
                candidates={kanbanCandidates.filter(c => c.stage === stage)}
                onDrop={updateStage}
                onEdit={openEditCand}
                onDelete={handleCandDelete}
              />
            ))}
          </div>

          <p className="text-xs text-muted-foreground">Arraste os cards entre as colunas para mover candidatos no pipeline.</p>
        </div>
      )}

      {/* Dialog vaga */}
      <Dialog open={jobDialog} onOpenChange={setJobDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingJob ? 'Editar vaga' : 'Nova vaga'}</DialogTitle></DialogHeader>
          <form onSubmit={handleJobSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Título da vaga *</Label>
              <Input placeholder="Ex: Desenvolvedor Full Stack" value={jobForm.title} onChange={e => setJobForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select defaultValue={jobForm.status} onValueChange={(v) => setJobForm(f => ({ ...f, status: (v ?? 'open') as JobStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(JOB_STATUS).map(([v, { label }]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Data abertura *</Label>
                <Input type="date" value={jobForm.open_date} onChange={e => setJobForm(f => ({ ...f, open_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea rows={3} placeholder="Descreva a vaga..." value={jobForm.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setJobForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Requisitos</Label>
              <Textarea rows={3} placeholder="Requisitos necessários..." value={jobForm.requirements} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setJobForm(f => ({ ...f, requirements: e.target.value }))} />
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
          <DialogHeader><DialogTitle>{editingCand ? 'Editar candidato' : 'Adicionar candidato'}</DialogTitle></DialogHeader>
          <form onSubmit={handleCandSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="Nome completo" value={candForm.name} onChange={e => setCandForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>E-mail *</Label>
                <Input type="email" placeholder="email@exemplo.com" value={candForm.email} onChange={e => setCandForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input placeholder="(11) 99999-9999" value={candForm.phone} onChange={e => setCandForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Etapa</Label>
              <Select defaultValue={candForm.stage} onValueChange={(v) => setCandForm(f => ({ ...f, stage: (v ?? 'applied') as CandidateStage }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(STAGES).map(([v, { label }]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea rows={2} placeholder="Notas sobre o candidato..." value={candForm.notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCandForm(f => ({ ...f, notes: e.target.value }))} />
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
