import Link from 'next/link'
import { ArrowLeft, SearchX } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-950 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="inline-flex h-20 w-20 rounded-2xl bg-blue-600/20 border border-blue-500/30 items-center justify-center mb-6 mx-auto">
          <SearchX className="h-10 w-10 text-blue-400" />
        </div>
        <h1 className="text-6xl font-black text-white mb-3">404</h1>
        <h2 className="text-xl font-bold text-slate-300 mb-3">Página não encontrada</h2>
        <p className="text-slate-500 mb-8">Esta página não existe ou foi movida. Volte ao início e continue de onde parou.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/dashboard"
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
            <ArrowLeft className="h-4 w-4" /> Voltar ao dashboard
          </Link>
          <Link href="/"
            className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-xl transition-colors border border-white/20">
            Página inicial
          </Link>
        </div>
        <div className="mt-10 inline-flex items-center gap-2">
          <div className="h-7 w-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-xs">RH</span>
          </div>
          <span className="text-slate-500 text-sm">RH Control</span>
        </div>
      </div>
    </div>
  )
}
