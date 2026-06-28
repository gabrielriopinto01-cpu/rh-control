'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { BadgeCheck, ShieldX, Loader2, Building2 } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

type Badge = {
  full_name: string
  employee_code: string | null
  status: string
  avatar_url: string | null
  badge_active: boolean
  position_title: string | null
  department_name: string | null
  company_name: string | null
  company_logo: string | null
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:     { label: 'Ativo',     color: 'text-green-600' },
  inactive:   { label: 'Inativo',   color: 'text-gray-500' },
  on_leave:   { label: 'Afastado',  color: 'text-yellow-600' },
  terminated: { label: 'Desligado', color: 'text-red-600' },
}

export default function BadgePage() {
  const { token } = useParams() as { token: string }
  const [badge,   setBadge]   = useState<Badge | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    (async () => {
      if (!isSupabaseConfigured()) { setError(true); setLoading(false); return }
      const supabase = createClient()
      const { data, error } = await supabase.rpc('public_badge', { p_token: token })
      const row = Array.isArray(data) ? data[0] : data
      if (error || !row) { setError(true); setLoading(false); return }
      setBadge(row as Badge)
      setLoading(false)
    })()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (error || !badge) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 px-6 text-center">
        <ShieldX className="h-14 w-14 text-red-400 mb-4" />
        <h1 className="text-xl font-bold text-gray-800">Crachá inválido ou revogado</h1>
        <p className="text-gray-500 mt-2">Este QR Code não corresponde a um crachá ativo.</p>
      </div>
    )
  }

  const st = STATUS_LABEL[badge.status] ?? { label: badge.status, color: 'text-gray-500' }
  const initials = badge.full_name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 px-4 py-8">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Cabeçalho com a empresa */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-6 py-5 flex items-center gap-3">
          {badge.company_logo
            ? <img src={badge.company_logo} alt="" className="h-10 w-10 rounded-lg object-cover bg-white/20" />
            : <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center"><Building2 className="h-5 w-5 text-white" /></div>}
          <div>
            <p className="text-white font-semibold leading-tight">{badge.company_name ?? 'Empresa'}</p>
            <p className="text-white/70 text-xs">Identificação do colaborador</p>
          </div>
        </div>

        {/* Foto + dados */}
        <div className="px-6 py-6 flex flex-col items-center text-center">
          <div className="h-28 w-28 rounded-full overflow-hidden border-4 border-slate-100 shadow-sm mb-4">
            {badge.avatar_url
              ? <img src={badge.avatar_url} alt={badge.full_name} className="h-full w-full object-cover" />
              : <div className="h-full w-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold">{initials}</div>}
          </div>
          <h1 className="text-xl font-bold text-gray-900">{badge.full_name}</h1>
          {badge.position_title && <p className="text-gray-600 mt-0.5">{badge.position_title}</p>}
          {badge.department_name && <p className="text-gray-400 text-sm">{badge.department_name}</p>}

          <div className="flex items-center gap-2 mt-4">
            <BadgeCheck className="h-4 w-4 text-green-500" />
            <span className={`text-sm font-medium ${st.color}`}>{st.label}</span>
          </div>
          {badge.employee_code && (
            <p className="text-xs text-gray-400 mt-2">Matrícula: {badge.employee_code}</p>
          )}
        </div>

        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">Verificado por RH Control · {new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>
    </div>
  )
}
