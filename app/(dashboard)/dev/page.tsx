'use client'

import { useState } from 'react'
import { Loader2, DatabaseZap, Trash2, CheckCircle2, AlertCircle, Terminal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export const dynamic = 'force-dynamic'

export default function DevPage() {
  const { user } = useAuth()
  const [seeding,   setSeeding]   = useState(false)
  const [clearing,  setClearing]  = useState(false)
  const [log,       setLog]       = useState<string[]>([])
  const [status,    setStatus]    = useState<'idle' | 'success' | 'error'>('idle')

  if (!user || !['adm_total', 'rh'].includes(user.role)) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <p className="text-gray-400 text-sm">Acesso restrito.</p>
      </div>
    )
  }

  const getToken = async () => {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? ''
  }

  const handleSeed = async () => {
    if (!confirm(`Popular a empresa "${user.company_id}" com dados de demonstração?\n\nIsso criará 12 colaboradores, 5 departamentos, 10 cargos, férias e folha de pagamento.`)) return
    setSeeding(true)
    setLog([])
    setStatus('idle')
    try {
      const token = await getToken()
      const res = await fetch('/api/dev/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ company_id: user.company_id }),
      })
      const json = await res.json()
      if (!res.ok) {
        setLog([`❌ ${json.error}`])
        setStatus('error')
        toast.error(json.error)
      } else {
        setLog(json.log ?? [])
        setStatus('success')
        toast.success('Dados populados com sucesso! Recarregue o dashboard.')
      }
    } catch {
      setLog(['❌ Erro de rede'])
      setStatus('error')
      toast.error('Erro ao conectar com a API')
    }
    setSeeding(false)
  }

  const handleClear = async () => {
    if (!confirm(`⚠️ ATENÇÃO\n\nIsso vai deletar TODOS os colaboradores, departamentos, cargos, férias e folhas de pagamento da empresa.\n\nTem certeza absoluta?`)) return
    setClearing(true)
    setLog([])
    setStatus('idle')
    try {
      const token = await getToken()
      const res = await fetch('/api/dev/seed', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ company_id: user.company_id }),
      })
      const json = await res.json()
      if (!res.ok) {
        setLog([`❌ ${json.error}`])
        setStatus('error')
        toast.error(json.error)
      } else {
        setLog(['🗑️ Todos os dados foram removidos.'])
        setStatus('success')
        toast.success('Dados limpos com sucesso!')
      }
    } catch {
      setLog(['❌ Erro de rede'])
      setStatus('error')
      toast.error('Erro ao conectar com a API')
    }
    setClearing(false)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ferramentas de Dev</h1>
        <p className="text-gray-500 mt-1">Popular e limpar dados de teste — somente para desenvolvimento</p>
      </div>

      {/* Aviso */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold mb-1">Ambiente de desenvolvimento</p>
          <p>Esta página cria dados fictícios para validar o sistema. Não use em produção com dados reais.</p>
        </div>
      </div>

      {/* Company info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2 text-sm">
        <p className="text-gray-500 text-xs uppercase tracking-wide font-medium">Empresa atual</p>
        <p className="font-mono text-gray-700 break-all">{user.company_id}</p>
        <p className="text-gray-600">{user.full_name} — <span className="font-medium">{user.role}</span></p>
      </div>

      {/* Ações */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <DatabaseZap className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Popular dados</p>
              <p className="text-xs text-gray-400">12 colaboradores, 5 depts, 10 cargos</p>
            </div>
          </div>
          <ul className="text-xs text-gray-500 space-y-0.5">
            <li>• 5 departamentos reais</li>
            <li>• 10 cargos com CBO e faixa salarial</li>
            <li>• 12 colaboradores com dados completos</li>
            <li>• Férias (pendentes, aprovadas, usufruídas)</li>
            <li>• Folha de pagamento do mês atual</li>
          </ul>
          <Button
            className="w-full"
            onClick={handleSeed}
            disabled={seeding || clearing}
          >
            {seeding
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Populando...</>
              : <><DatabaseZap className="h-4 w-4 mr-2" /> Popular agora</>
            }
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center">
              <Trash2 className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Limpar dados</p>
              <p className="text-xs text-gray-400">Remove tudo — irreversível</p>
            </div>
          </div>
          <ul className="text-xs text-gray-500 space-y-0.5">
            <li>• Deleta todos os colaboradores</li>
            <li>• Deleta todos os departamentos</li>
            <li>• Deleta todos os cargos</li>
            <li>• Deleta férias e folha de pagamento</li>
            <li>• ⚠️ Ação irreversível</li>
          </ul>
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleClear}
            disabled={seeding || clearing}
          >
            {clearing
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Limpando...</>
              : <><Trash2 className="h-4 w-4 mr-2" /> Limpar dados</>
            }
          </Button>
        </div>
      </div>

      {/* Log de saída */}
      {log.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Terminal className="h-4 w-4 text-gray-400" />
            <span className="text-xs text-gray-400 font-mono uppercase tracking-wide">Output</span>
            {status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-400 ml-auto" />}
            {status === 'error'   && <AlertCircle  className="h-4 w-4 text-red-400 ml-auto" />}
          </div>
          <div className="space-y-1">
            {log.map((line, i) => (
              <p key={i} className="text-sm font-mono text-green-300">{line}</p>
            ))}
          </div>
          {status === 'success' && (
            <div className="mt-4 pt-3 border-t border-gray-700">
              <p className="text-xs text-gray-400">
                Acesse o{' '}
                <a href="/dashboard" className="text-blue-400 underline">Dashboard</a>
                {', '}
                <a href="/employees" className="text-blue-400 underline">Colaboradores</a>
                {', '}
                <a href="/vacations" className="text-blue-400 underline">Férias</a>
                {' e '}
                <a href="/cargos" className="text-blue-400 underline">Cargos</a>
                {' para ver os dados.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
