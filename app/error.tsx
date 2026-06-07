'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-950 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="inline-flex h-20 w-20 rounded-2xl bg-red-500/20 border border-red-500/30 items-center justify-center mb-6 mx-auto">
          <AlertTriangle className="h-10 w-10 text-red-400" />
        </div>
        <h1 className="text-2xl font-black text-white mb-3">Algo deu errado</h1>
        <p className="text-slate-400 mb-8 text-sm">
          Ocorreu um erro inesperado. Se o problema persistir, entre em contato com o suporte.
          {error.digest && <span className="block mt-2 font-mono text-xs text-slate-600">#{error.digest}</span>}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset} className="bg-blue-600 hover:bg-blue-700 text-white">
            <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/dashboard'}
            className="border-white/20 text-white hover:bg-white/10">
            Voltar ao início
          </Button>
        </div>
      </div>
    </div>
  )
}
