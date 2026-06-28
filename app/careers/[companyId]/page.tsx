'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Briefcase, MapPin, Clock, Send, Loader2, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Toaster } from 'sonner'

export const dynamic = 'force-dynamic'

type Job = {
  id: string
  title: string
  department: string | null
  location: string | null
  type: string | null
  description: string | null
  requirements: string | null
  salary_range: string | null
  created_at: string
}

type Company = { name: string; logo_url?: string | null }

const JOB_TYPES: Record<string, string> = {
  clt:       'CLT',
  pj:        'PJ',
  internship:'Estágio',
  temp:      'Temporário',
  freelance: 'Freelance',
}

export default function CareersPage() {
  const { companyId } = useParams() as { companyId: string }
  const [company,  setCompany]  = useState<Company | null>(null)
  const [jobs,     setJobs]     = useState<Job[]>([])
  const [loading,  setLoading]  = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [selected, setSelected] = useState<Job | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  // form state
  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [phone,   setPhone]   = useState('')
  const [notes,   setNotes]   = useState('')
  const [sending, setSending] = useState(false)
  const [sent,    setSent]    = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const [compRes, jobsRes] = await Promise.all([
        supabase.from('companies').select('name, logo_url').eq('id', companyId).single(),
        supabase.from('job_openings')
          .select('id, title, department:departments(name), location, type, description, requirements, salary_range, created_at')
          .eq('company_id', companyId)
          .eq('status', 'open')
          .order('created_at', { ascending: false }),
      ])
      if (compRes.error || !compRes.data) { setNotFound(true); setLoading(false); return }
      setCompany(compRes.data as Company)
      setJobs((jobsRes.data ?? []).map((j: any) => ({
        ...j,
        department: j.department?.name ?? null,
      })))
      setLoading(false)
    }
    load()
  }, [companyId])

  const apply = async () => {
    if (!selected) return
    if (!name.trim() || !email.trim()) { toast.error('Nome e e-mail são obrigatórios'); return }
    setSending(true)
    try {
      const res = await fetch('/api/careers/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_opening_id: selected.id, name, email, phone, notes }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erro ao enviar candidatura'); return }
      setSent(true)
    } catch {
      toast.error('Erro de conexão. Tente novamente.')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 text-center px-4">
        <Briefcase className="h-12 w-12 text-gray-300" />
        <h1 className="text-xl font-semibold text-gray-700">Portal de vagas não encontrado</h1>
        <p className="text-gray-400">O link pode estar incorreto ou a empresa não possui vagas publicadas.</p>
      </div>
    )
  }

  return (
    <>
      <Toaster />
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-6 flex items-center gap-4">
            {company && (
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {company.name.charAt(0)}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{company.name}</h1>
                  <p className="text-sm text-gray-500">Portal de Vagas</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-10">
          {jobs.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Nenhuma vaga aberta no momento</p>
              <p className="text-sm mt-1">Volte em breve para conferir novas oportunidades!</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {jobs.length} {jobs.length === 1 ? 'vaga aberta' : 'vagas abertas'}
              </h2>

              <div className="space-y-4">
                {jobs.map(job => (
                  <div key={job.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {/* Card header */}
                    <div
                      className="p-5 flex items-start gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setExpanded(expanded === job.id ? null : job.id)}
                    >
                      <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                        <Briefcase className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-base">{job.title}</h3>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5">
                          {job.department && (
                            <span className="text-sm text-gray-500">{job.department}</span>
                          )}
                          {job.location && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <MapPin className="h-3 w-3" /> {job.location}
                            </span>
                          )}
                          {job.type && (
                            <Badge variant="secondary" className="text-xs">
                              {JOB_TYPES[job.type] ?? job.type}
                            </Badge>
                          )}
                          {job.salary_range && (
                            <span className="text-xs text-green-700 font-medium bg-green-50 px-2 py-0.5 rounded-full">
                              {job.salary_range}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs"
                          onClick={e => { e.stopPropagation(); setSelected(job); setSent(false); setName(''); setEmail(''); setPhone(''); setNotes('') }}
                        >
                          Candidatar-se
                        </Button>
                        {expanded === job.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {expanded === job.id && (job.description || job.requirements) && (
                      <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-3">
                        {job.description && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Sobre a vaga</p>
                            <p className="text-sm text-gray-700 whitespace-pre-line">{job.description}</p>
                          </div>
                        )}
                        {job.requirements && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Requisitos</p>
                            <p className="text-sm text-gray-700 whitespace-pre-line">{job.requirements}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Modal de candidatura */}
        {selected && (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
              {sent ? (
                <div className="p-8 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Candidatura enviada!</h3>
                  <p className="text-sm text-gray-500">Obrigado, <strong>{name}</strong>! Nossa equipe de RH entrará em contato em breve.</p>
                  <Button className="mt-6 w-full" onClick={() => setSelected(null)}>Fechar</Button>
                </div>
              ) : (
                <>
                  <div className="p-5 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-gray-900">{selected.title}</h3>
                        <p className="text-sm text-gray-400">{company?.name}</p>
                      </div>
                      <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
                    </div>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <Label className="text-xs">Nome completo *</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">E-mail *</Label>
                        <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Telefone / WhatsApp</Label>
                        <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Por que você quer esta vaga?</Label>
                        <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Fale um pouco sobre você..." rows={3} className="mt-1 resize-none" />
                      </div>
                    </div>
                    <Button
                      className="w-full bg-indigo-600 hover:bg-indigo-700"
                      disabled={sending || !name.trim() || !email.trim()}
                      onClick={apply}
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                      Enviar candidatura
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-8 text-xs text-gray-400">
          Powered by <span className="font-semibold text-indigo-400">RH Control</span> · Desenvolvido por GRP Tecnologia
        </div>
      </div>
    </>
  )
}
