'use client'

import { useEffect, useState, useCallback } from 'react'
import { FileText, ExternalLink, AlertCircle, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useMyEmployee } from '@/hooks/use-my-employee'
import { formatDate } from '@/lib/utils'
import type { Document, DocumentType } from '@/types/database'

export const dynamic = 'force-dynamic'

const DOC_LABELS: Record<DocumentType, string> = {
  cpf: 'CPF', rg: 'RG', ctps: 'CTPS', pis: 'PIS', contrato: 'Contrato',
  admissao: 'Admissão', demissao: 'Demissão', ferias: 'Férias', atestado: 'Atestado', outro: 'Outro',
}

const DOC_COLORS: Record<DocumentType, string> = {
  cpf: 'bg-blue-100 text-blue-700', rg: 'bg-indigo-100 text-indigo-700',
  ctps: 'bg-purple-100 text-purple-700', pis: 'bg-violet-100 text-violet-700',
  contrato: 'bg-green-100 text-green-700', admissao: 'bg-teal-100 text-teal-700',
  demissao: 'bg-red-100 text-red-700', ferias: 'bg-yellow-100 text-yellow-700',
  atestado: 'bg-orange-100 text-orange-700', outro: 'bg-gray-100 text-gray-700',
}

function isExpiringSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  return (new Date(expiresAt).getTime() - Date.now()) < 30 * 86400000
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

export default function MeusDocumentosPage() {
  const { user }                          = useAuth()
  const { employee, loading: empLoading } = useMyEmployee()

  const [documents, setDocuments] = useState<Document[]>([])
  const [loading,   setLoading]   = useState(true)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user || !employee) { setLoading(false); return }
    const supabase = createClient()
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('company_id', user.company_id)
      .eq('employee_id', employee.id)
      .order('created_at', { ascending: false })
    setDocuments(data ?? [])
    setLoading(false)
  }, [user, employee])

  useEffect(() => { load() }, [load])

  if (empLoading) return <div className="p-8 text-center text-gray-400">Carregando...</div>

  if (!employee) return (
    <div className="p-12 text-center">
      <AlertCircle className="h-10 w-10 text-yellow-400 mx-auto mb-3" />
      <p className="font-semibold text-gray-700">Perfil de funcionário não encontrado</p>
    </div>
  )

  const expiring = documents.filter(d => !isExpired(d.expires_at) && isExpiringSoon(d.expires_at))
  const expired  = documents.filter(d => isExpired(d.expires_at))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meus Documentos</h1>
        <p className="text-gray-500 mt-1">{employee.full_name}</p>
      </div>

      {/* Alertas */}
      {expired.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">{expired.length} documento(s) vencido(s)</p>
            <p className="text-xs text-red-500 mt-0.5">{expired.map(d => d.name).join(', ')}</p>
          </div>
        </div>
      )}
      {expiring.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-yellow-700">{expiring.length} documento(s) vencem em breve</p>
            <p className="text-xs text-yellow-600 mt-0.5">{expiring.map(d => d.name).join(', ')}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-400">Carregando...</div>
      ) : documents.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Nenhum documento disponível</p>
          <p className="text-gray-400 text-xs mt-1">O RH adicionará seus documentos aqui</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {documents.map(doc => {
            const expired_  = isExpired(doc.expires_at)
            const expiring_ = !expired_ && isExpiringSoon(doc.expires_at)
            return (
              <div key={doc.id}
                className={`bg-white rounded-xl border p-5 flex items-start justify-between gap-3 transition-shadow hover:shadow-sm ${expired_ ? 'border-red-200' : expiring_ ? 'border-yellow-200' : 'border-gray-200'}`}>
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`p-2 rounded-lg shrink-0 ${DOC_COLORS[doc.type]}`}>
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">{doc.name}</p>
                    <span className={`inline-block text-xs px-1.5 py-0.5 rounded font-medium mt-1 ${DOC_COLORS[doc.type]}`}>
                      {DOC_LABELS[doc.type]}
                    </span>
                    {doc.expires_at && (
                      <p className={`text-xs mt-1 ${expired_ ? 'text-red-500 font-semibold' : expiring_ ? 'text-yellow-600 font-medium' : 'text-gray-400'}`}>
                        {expired_ ? '⚠ Vencido em' : 'Vence em'} {formatDate(doc.expires_at)}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">Adicionado em {formatDate(doc.created_at.slice(0, 10))}</p>
                  </div>
                </div>
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-700 shrink-0 mt-1" title="Abrir documento">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
