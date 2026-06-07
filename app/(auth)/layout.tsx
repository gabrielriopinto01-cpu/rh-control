import { Toaster } from 'sonner'

export const dynamic = 'force-dynamic'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-900 flex items-center justify-center p-4">
      <Toaster position="top-center" richColors />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">RH Control</h1>
          <p className="text-slate-400 mt-1">Gestão de RH inteligente</p>
        </div>
        {children}
      </div>
    </div>
  )
}
