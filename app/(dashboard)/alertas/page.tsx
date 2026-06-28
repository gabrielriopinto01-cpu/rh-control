'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell, FileWarning, FileX, Stethoscope, Palmtree, Cake, Award, Loader2, CheckCircle2,
  Laptop, GraduationCap, GitMerge,
} from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { computeAlerts, type Alert, type AlertType, type AlertSeverity } from '@/lib/alerts'

export const dynamic = 'force-dynamic'

const ICON: Record<AlertType, React.ComponentType<{ className?: string }>> = {
  document_expired:  FileX,
  document_expiring: FileWarning,
  aso_expiring:      Stethoscope,
  vacation_pending:  Palmtree,
  vacation_upcoming: Palmtree,
  birthday:          Cake,
  work_anniversary:  Award,
  equipment_unreturned: Laptop,
  training_pending:  GraduationCap,
  approval_pending:  GitMerge,
}

const SEV_STYLE: Record<AlertSeverity, { dot: string; chip: string; label: string }> = {
  high:   { dot: 'bg-red-500',    chip: 'bg-red-50 text-red-700 border-red-200',       label: 'Urgente' },
  medium: { dot: 'bg-amber-500',  chip: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Atenção' },
  low:    { dot: 'bg-blue-500',   chip: 'bg-blue-50 text-blue-700 border-blue-200',    label: 'Informativo' },
}

export default function AlertasPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [alerts,  setAlerts]  = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<AlertSeverity | 'all'>('all')

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    setLoading(true)
    const supabase = createClient()
    try {
      setAlerts(await computeAlerts(supabase, user.company_id))
    } catch {
      setAlerts([])
    }
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const counts = {
    high:   alerts.filter(a => a.severity === 'high').length,
    medium: alerts.filter(a => a.severity === 'medium').length,
    low:    alerts.filter(a => a.severity === 'low').length,
  }
  const visible = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter)

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="h-6 w-6 text-brand" /> Alertas
          </h1>
          <p className="text-gray-500 mt-1">Pendências e vencimentos que precisam da sua atenção</p>
        </div>
      </div>

      {/* Resumo por severidade (também funciona como filtro) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {([
          { key: 'all',    label: 'Todos',       value: alerts.length,  color: 'text-gray-900' },
          { key: 'high',   label: 'Urgentes',    value: counts.high,    color: 'text-red-600' },
          { key: 'medium', label: 'Atenção',     value: counts.medium,  color: 'text-amber-600' },
          { key: 'low',    label: 'Informativos',value: counts.low,     color: 'text-blue-600' },
        ] as const).map(s => (
          <button key={s.key} onClick={() => setFilter(s.key as AlertSeverity | 'all')}
            className={`bg-white rounded-xl border p-4 text-left transition-colors ${
              filter === s.key ? 'border-brand ring-1 ring-brand' : 'border-gray-200 hover:border-gray-300'}`}>
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-400 mb-3" />
            <p className="font-medium text-gray-700">Tudo em dia!</p>
            <p className="text-sm text-gray-400">Nenhum alerta {filter !== 'all' ? 'nesta categoria' : 'no momento'}.</p>
          </div>
        ) : visible.map(a => {
          const Icon = ICON[a.type]
          const sev  = SEV_STYLE[a.severity]
          return (
            <button key={a.id} onClick={() => router.push(a.href)}
              className="w-full flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left">
              <div className="relative mt-0.5">
                <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-gray-600" />
                </div>
                <span className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ${sev.dot}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">{a.title}</p>
                <p className="text-sm text-gray-500">{a.description}</p>
              </div>
              <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${sev.chip}`}>{sev.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
