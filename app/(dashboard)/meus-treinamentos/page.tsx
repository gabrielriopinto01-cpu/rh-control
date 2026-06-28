'use client'

import { useEffect, useState, useCallback } from 'react'
import { GraduationCap, Video, FileText, Link2, CheckCircle2, ExternalLink, Award, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useMyEmployee } from '@/hooks/use-my-employee'
import { formatDate } from '@/lib/utils'
import type { Training, TrainingContentType, TrainingCompletion } from '@/types/database'

export const dynamic = 'force-dynamic'

const TYPE_ICON: Record<TrainingContentType, React.ComponentType<{ className?: string }>> = {
  video: Video, pdf: FileText, link: Link2,
}

export default function MeusTreinamentosPage() {
  const { user } = useAuth()
  const { employee, loading: empLoading } = useMyEmployee()
  const [trainings,   setTrainings]   = useState<Training[]>([])
  const [completions, setCompletions] = useState<TrainingCompletion[]>([])
  const [loading,     setLoading]     = useState(true)
  const [cert,        setCert]        = useState<{ training: Training; completion: TrainingCompletion } | null>(null)
  const [companyName, setCompanyName] = useState('')

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user || !employee) { setLoading(false); return }
    const supabase = createClient()
    const [tRes, cRes, compRes] = await Promise.all([
      supabase.from('trainings').select('*').eq('company_id', user.company_id).eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('training_completions').select('*').eq('employee_id', employee.id),
      supabase.from('companies').select('name').eq('id', user.company_id).single(),
    ])
    setTrainings((tRes.data as Training[]) ?? [])
    setCompletions((cRes.data as TrainingCompletion[]) ?? [])
    setCompanyName(compRes.data?.name ?? '')
    setLoading(false)
  }, [user, employee])

  useEffect(() => { load() }, [load])

  const completionOf = (tid: string) => completions.find(c => c.training_id === tid)

  const markComplete = async (t: Training) => {
    if (!isSupabaseConfigured() || !user || !employee) return
    const supabase = createClient()
    const { error } = await supabase.from('training_completions').insert({
      training_id: t.id, employee_id: employee.id, company_id: user.company_id,
    })
    if (error) { toast.error('Erro ao concluir'); return }
    toast.success('Treinamento concluído! Certificado disponível 🎓')
    load()
  }

  if (empLoading || loading) return <div className="p-8 text-center text-gray-400">Carregando...</div>

  if (!employee) return (
    <div className="p-12 text-center">
      <AlertCircle className="h-10 w-10 text-yellow-400 mx-auto mb-3" />
      <p className="font-semibold text-gray-700">Seu usuário não está vinculado a um colaborador</p>
    </div>
  )

  const doneCount = completions.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meus Treinamentos</h1>
        <p className="text-gray-500 mt-1">{doneCount} de {trainings.length} concluído(s)</p>
      </div>

      {trainings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <GraduationCap className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Nenhum treinamento disponível</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {trainings.map(t => {
            const Icon = TYPE_ICON[t.content_type]
            const comp = completionOf(t.id)
            return (
              <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-indigo-600" />
                  </div>
                  {comp && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                </div>
                <h3 className="font-semibold text-gray-900 mt-3">{t.title}</h3>
                {t.description && <p className="text-sm text-gray-500 mt-1 line-clamp-3 flex-1">{t.description}</p>}
                <div className="mt-4 space-y-2">
                  {t.content_url && (
                    <a href={t.content_url} target="_blank" rel="noreferrer"
                      className="flex items-center justify-center gap-1.5 text-sm text-indigo-600 hover:underline">
                      <ExternalLink className="h-4 w-4" /> Acessar conteúdo
                    </a>
                  )}
                  {comp ? (
                    <Button variant="outline" className="w-full" onClick={() => setCert({ training: t, completion: comp })}>
                      <Award className="h-4 w-4 mr-2" /> Ver certificado
                    </Button>
                  ) : (
                    <Button className="w-full" onClick={() => markComplete(t)}>
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Marcar como concluído
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Certificado */}
      <Dialog open={!!cert} onOpenChange={(o) => { if (!o) setCert(null) }}>
        <DialogContent className="max-w-lg">
          {cert && (
            <>
              <div id="cert-print" className="border-4 border-double border-indigo-200 rounded-xl p-8 text-center bg-gradient-to-br from-white to-indigo-50">
                <Award className="h-12 w-12 text-indigo-500 mx-auto" />
                <p className="text-sm uppercase tracking-widest text-gray-400 mt-4">Certificado de Conclusão</p>
                <p className="text-gray-600 mt-4">Certificamos que</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{employee.full_name}</p>
                <p className="text-gray-600 mt-3">concluiu o treinamento</p>
                <p className="text-lg font-semibold text-indigo-700 mt-1">{cert.training.title}</p>
                <p className="text-sm text-gray-400 mt-4">
                  {companyName} · {formatDate(cert.completion.completed_at.slice(0, 10))}
                </p>
              </div>
              <Button onClick={() => window.print()} className="w-full">Imprimir certificado</Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
