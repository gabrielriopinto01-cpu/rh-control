'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner]       = useState(false)

  useEffect(() => {
    // Registra o service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch(() => {/* silencia erros em dev */})
    }

    // Captura o evento de instalação do PWA
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
      // Mostra banner apenas para colaboradores (quem bate ponto no celular)
      setShowBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setShowBanner(false)
    setInstallPrompt(null)
  }

  // Só mostra banner para colaboradores
  const isColaborador = user?.role === 'colaborador'

  return (
    <>
      {children}

      {/* Banner de instalação */}
      {showBanner && isColaborador && installPrompt && (
        <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-80">
          <div className="bg-slate-900 text-white rounded-2xl shadow-2xl p-4 flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
              <span className="font-bold text-sm">RH</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Instalar RH Control</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Adicione à tela inicial para bater ponto rapidamente
              </p>
              <button
                onClick={handleInstall}
                className="mt-3 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Instalar app
              </button>
            </div>
            <button
              onClick={() => setShowBanner(false)}
              className="text-slate-500 hover:text-white transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
