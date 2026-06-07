'use client'

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="h-20 w-20 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-6">
          <span className="text-white font-black text-2xl">RH</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Sem conexão</h1>
        <p className="text-slate-400 mb-6">
          Você está offline. Reconecte à internet para continuar usando o RH Control.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  )
}
