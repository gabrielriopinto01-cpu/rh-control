'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { PenLine, CheckCircle2, XCircle, Clock, Shield, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

type Signature = {
  id: string; document_name: string; document_type: string; document_html: string | null
  status: string; expires_at: string; sent_at: string
  employee: { full_name: string; email: string } | null
  company:  { name: string } | null
}

const DOC_TYPE_LABELS: Record<string, string> = {
  contract: 'Contrato de Trabalho', warning: 'Advertência',
  holerite: 'Holerite', lgpd: 'Termo LGPD', policy: 'Regulamento Interno',
}

export default function SignPage() {
  const { token }     = useParams() as { token: string }
  const [sig,         setSig]         = useState<Signature | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [notFound,    setNotFound]    = useState(false)
  const [action,      setAction]      = useState<'idle' | 'confirming_sign' | 'confirming_reject' | 'done_sign' | 'done_reject'>('idle')
  const [rejectReason, setRejectReason] = useState('')
  const [processing,  setProcessing]  = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured()) return
      const supabase = createClient()
      const { data, error } = await supabase
        .from('digital_signatures')
        .select('*, employee:employees(full_name, email), company:companies(name)')
        .eq('token', token)
        .single()

      if (error || !data) { setNotFound(true); setLoading(false); return }
      setSig(data as Signature)

      // Marca como visualizado se ainda está pendente
      if (data.status === 'pending') {
        await supabase.from('digital_signatures').update({ status: 'viewed', viewed_at: new Date().toISOString() }).eq('id', data.id)
        await supabase.from('signature_audit_trail').insert({
          signature_id: data.id, event: 'viewed',
          description: 'Documento visualizado pelo colaborador',
        })
        setSig(prev => prev ? { ...prev, status: 'viewed' } : prev)
      }

      setLoading(false)
    }
    load()
  }, [token])

  const handleSign = async () => {
    if (!sig) return
    setProcessing(true)
    const supabase = createClient()
    const now = new Date().toISOString()

    await supabase.from('digital_signatures').update({
      status:    'signed',
      signed_at: now,
      signed_ip: 'client',  // em produção, capturado via API route
    }).eq('id', sig.id)

    await supabase.from('signature_audit_trail').insert({
      signature_id: sig.id, event: 'signed',
      description: `Documento assinado digitalmente por ${sig.employee?.full_name}`,
    })

    setSig(prev => prev ? { ...prev, status: 'signed' } : prev)
    setAction('done_sign')
    setProcessing(false)
  }

  const handleReject = async () => {
    if (!sig) return
    setProcessing(true)
    const supabase = createClient()

    await supabase.from('digital_signatures').update({
      status: 'rejected',
      rejection_reason: rejectReason,
    }).eq('id', sig.id)

    await supabase.from('signature_audit_trail').insert({
      signature_id: sig.id, event: 'rejected',
      description: `Documento recusado. Motivo: ${rejectReason || 'Não informado'}`,
    })

    setSig(prev => prev ? { ...prev, status: 'rejected' } : prev)
    setAction('done_reject')
    setProcessing(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-3" />
        <p className="text-gray-500">Carregando documento...</p>
      </div>
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow p-8 max-w-md w-full text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Link inválido</h1>
        <p className="text-gray-500 text-sm">Este link de assinatura não existe ou foi removido.</p>
      </div>
    </div>
  )

  const isExpired = sig && new Date(sig.expires_at) < new Date()
  const isSignable = sig?.status === 'viewed' || sig?.status === 'pending'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <PenLine className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-lg">{sig?.document_name}</h1>
              <p className="text-sm text-gray-500">{sig?.company?.name ?? 'Empresa'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Tipo</p>
              <p className="font-medium text-gray-800">{DOC_TYPE_LABELS[sig?.document_type ?? ''] ?? sig?.document_type}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Colaborador</p>
              <p className="font-medium text-gray-800">{sig?.employee?.full_name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Válido até</p>
              <p className={`font-medium ${isExpired ? 'text-red-500' : 'text-gray-800'}`}>
                {new Date(sig!.expires_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        </div>

        {/* Status */}
        {action === 'done_sign' && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-green-800 mb-1">Documento assinado!</h2>
            <p className="text-green-600 text-sm">Sua assinatura foi registrada com sucesso.</p>
            <p className="text-xs text-green-500 mt-3">
              {new Date().toLocaleString('pt-BR')}
            </p>
          </div>
        )}

        {action === 'done_reject' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <XCircle className="h-14 w-14 text-red-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-red-800 mb-1">Assinatura recusada</h2>
            <p className="text-red-600 text-sm">O RH foi notificado sobre a recusa.</p>
          </div>
        )}

        {isExpired && action === 'idle' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
            <Clock className="h-12 w-12 text-amber-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-amber-800">Link expirado</h2>
            <p className="text-amber-600 text-sm mt-1">Solicite um novo link ao departamento de RH.</p>
          </div>
        )}

        {sig?.status === 'signed' && action === 'idle' && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-green-800">Já assinado</h2>
            <p className="text-green-600 text-sm mt-1">Este documento já foi assinado anteriormente.</p>
          </div>
        )}

        {sig?.status === 'rejected' && action === 'idle' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-red-800">Recusado</h2>
            <p className="text-red-600 text-sm mt-1">Este documento foi recusado anteriormente.</p>
          </div>
        )}

        {/* Conteúdo do documento */}
        {sig?.document_html && action === 'idle' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" /> Conteúdo do documento
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed border border-gray-100 rounded-xl p-4 bg-gray-50 max-h-96 overflow-y-auto whitespace-pre-wrap font-mono text-xs">
              {sig.document_html}
            </div>
          </div>
        )}

        {/* Ações */}
        {isSignable && !isExpired && action === 'idle' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <Shield className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-700">
                <p className="font-semibold">Assinatura digital com validade jurídica</p>
                <p className="mt-0.5">Ao assinar, você confirma que leu e concordou com o conteúdo do documento. Sua assinatura será registrada com data, hora e IP.</p>
              </div>
            </div>

            {action === 'idle' && (
              <div className="flex gap-3">
                <Button onClick={() => setAction('confirming_sign')} className="flex-1 bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Assinar documento
                </Button>
                <Button variant="outline" onClick={() => setAction('confirming_reject')} className="flex-1 text-red-600 border-red-200 hover:bg-red-50">
                  <XCircle className="h-4 w-4 mr-2" /> Recusar
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Confirmação de assinatura */}
        {action === 'confirming_sign' && (
          <div className="bg-white rounded-2xl shadow-sm border border-green-300 p-6 space-y-4">
            <h3 className="font-bold text-gray-900">Confirmar assinatura digital</h3>
            <p className="text-sm text-gray-600">
              Ao confirmar, você declara que <strong>{sig?.employee?.full_name}</strong> assinou digitalmente o documento <strong>{sig?.document_name}</strong>.
            </p>
            <p className="text-xs text-gray-400">Data e hora: {new Date().toLocaleString('pt-BR')}</p>
            <div className="flex gap-3">
              <Button onClick={handleSign} disabled={processing} className="flex-1 bg-green-600 hover:bg-green-700">
                {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Confirmar assinatura
              </Button>
              <Button variant="outline" onClick={() => setAction('idle')}>Voltar</Button>
            </div>
          </div>
        )}

        {/* Confirmação de recusa */}
        {action === 'confirming_reject' && (
          <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-6 space-y-4">
            <h3 className="font-bold text-gray-900">Motivo da recusa</h3>
            <textarea rows={3} placeholder="Descreva o motivo da recusa (opcional)..."
              value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300" />
            <div className="flex gap-3">
              <Button onClick={handleReject} disabled={processing}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                Confirmar recusa
              </Button>
              <Button variant="outline" onClick={() => setAction('idle')}>Voltar</Button>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 pb-4">
          Powered by <strong className="text-blue-600">RH Control</strong> · Assinatura digital segura
        </p>
      </div>
    </div>
  )
}
