'use client'

import { useEffect, useState, useCallback } from 'react'
import { Users, Clock, Palmtree, CheckCircle2, AlertCircle, Gift, UserCheck, Loader2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

type TeamMember = { id: string; full_name: string; status: string }
type Vacation   = { employee_id: string; start_date: string; end_date: string; status: string; employees: { full_name: string } | null }
type Attendance = { employee_id: string; date: string; status: string; employees: { full_name: string } | null }
type Approval   = { id: string; type: string; created_at: string; requester: { full_name: string } | null }
type Birthday   = { id: string; full_name: string; birth_date: string }

const VACA_STATUS: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Aguardando',  color: 'bg-yellow-100 text-yellow-700' },
  approved:  { label: 'Aprovada',    color: 'bg-green-100 text-green-700' },
  rejected:  { label: 'Rejeitada',   color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelada',   color: 'bg-gray-100 text-gray-500' },
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo', inactive: 'Inativo', on_leave: 'Afastado', terminated: 'Desligado',
}
const STATUS_COLORS: Record<string, string> = {
  active:     'bg-green-100 text-green-700',
  inactive:   'bg-gray-100 text-gray-500',
  on_leave:   'bg-yellow-100 text-yellow-700',
  terminated: 'bg-red-100 text-red-600',
}

const ATT_LABELS: Record<string, string> = {
  present: 'Presente', absent: 'Falta', late: 'Atraso', justified: 'Justificada', remote: 'Remoto',
}
const ATT_COLORS: Record<string, string> = {
  present:   'bg-green-100 text-green-700',
  absent:    'bg-red-100 text-red-600',
  late:      'bg-amber-100 text-amber-700',
  justified: 'bg-blue-100 text-blue-600',
  remote:    'bg-purple-100 text-purple-700',
}

function daysBirth(dateStr: string) {
  const now    = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const bMonth = parseInt(dateStr.slice(5, 7)) - 1
  const bDay   = parseInt(dateStr.slice(8, 10))
  let next     = new Date(today.getFullYear(), bMonth, bDay)
  if (next < today) next = new Date(today.getFullYear() + 1, bMonth, bDay)
  return Math.round((next.getTime() - today.getTime()) / 86400000)
}

export default function GestorDashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [team,       setTeam]       = useState<TeamMember[]>([])
  const [vacations,  setVacations]  = useState<Vacation[]>([])
  const [todayAtt,   setTodayAtt]   = useState<Attendance[]>([])
  const [approvals,  setApprovals]  = useState<Approval[]>([])
  const [birthdays,  setBirthdays]  = useState<Birthday[]>([])

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user?.company_id) { setLoading(false); return }
    const supabase = createClient()
    const today    = new Date().toISOString().slice(0, 10)
    const in30     = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

    let empQ = supabase.from('employees').select('id, full_name, status')
      .eq('company_id', user.company_id).neq('status', 'terminated')
    if (user.department_id) empQ = empQ.eq('department_id', user.department_id)

    const [teamRes, vacRes, attRes, birthRes, approvalRes] = await Promise.allSettled([
      empQ,
      supabase.from('vacations')
        .select('employee_id, start_date, end_date, status, employees(full_name)')
        .eq('company_id', user.company_id)
        .in('status', ['pending', 'approved'])
        .gte('end_date', today)
        .lte('start_date', in30)
        .order('start_date'),
      supabase.from('attendance_records')
        .select('employee_id, date, status, employees(full_name)')
        .eq('company_id', user.company_id)
        .eq('date', today),
      supabase.from('employees')
        .select('id, full_name, birth_date')
        .eq('company_id', user.company_id)
        .not('birth_date', 'is', null)
        .eq('status', 'active'),
      supabase.from('approval_requests')
        .select('id, type, created_at, requester:profiles!requester_id(full_name)')
        .eq('company_id', user.company_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    const teamData = (teamRes.status === 'fulfilled' ? teamRes.value.data : null) ?? []
    setTeam(teamData)

    const vacData = (vacRes.status === 'fulfilled' ? vacRes.value.data : null) ?? []
    const teamIds = new Set(teamData.map((e: TeamMember) => e.id))
    setVacations((vacData as Vacation[]).filter(v => !user.department_id || teamIds.has(v.employee_id)))

    const attData = (attRes.status === 'fulfilled' ? attRes.value.data : null) ?? []
    setTodayAtt((attData as Attendance[]).filter(a => !user.department_id || teamIds.has(a.employee_id)))

    const bdays = ((birthRes.status === 'fulfilled' ? birthRes.value.data : null) ?? []) as Birthday[]
    const upcoming = bdays
      .filter(b => !user.department_id || teamIds.has(b.id))
      .map(b => ({ ...b, days: daysBirth(b.birth_date) }))
      .filter(b => b.days <= 30)
      .sort((a, b) => a.days - b.days)
      .slice(0, 5)
    setBirthdays(upcoming)

    setApprovals((approvalRes.status === 'fulfilled' ? (approvalRes.value.data as Approval[]) : []) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const active = team.filter(t => t.status === 'active').length
  const onLeave = team.filter(t => t.status === 'on_leave').length
  const todayPresent = todayAtt.filter(a => a.status === 'present' || a.status === 'remote').length
  const todayAbsent  = todayAtt.filter(a => a.status === 'absent').length
  const pendingVacs  = vacations.filter(v => v.status === 'pending').length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meu Departamento</h1>
        <p className="text-gray-500 mt-1">Visão da equipe — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Colaboradores ativos',  value: active,       icon: Users,       color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Presentes hoje',        value: todayPresent, icon: UserCheck,   color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Faltas hoje',           value: todayAbsent,  icon: Clock,       color: 'text-red-600',    bg: 'bg-red-50' },
          { label: 'Férias pendentes',      value: pendingVacs,  icon: Palmtree,    color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className={`p-3 rounded-xl ${bg} shrink-0`}>
                <Icon className={`h-6 w-6 ${color}`} />
              </div>
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Equipe */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" /> Equipe
            </CardTitle>
          </CardHeader>
          <CardContent>
            {team.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Nenhum colaborador no departamento</p>
            ) : (
              <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
                {team.map(m => (
                  <Link key={m.id} href={`/employees/${m.id}`}
                    className="flex items-center justify-between py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors">
                    <span className="text-sm font-medium text-gray-800 truncate">{m.full_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 shrink-0 ${STATUS_COLORS[m.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABELS[m.status] ?? m.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
            {onLeave > 0 && (
              <p className="text-xs text-amber-600 mt-3 text-center">{onLeave} afastado(s) no momento</p>
            )}
          </CardContent>
        </Card>

        {/* Ponto de hoje */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" /> Ponto de Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayAtt.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-gray-400">Sem registros de ponto hoje</p>
                <Link href="/attendance" className="text-xs text-blue-500 hover:underline mt-1 block">
                  Ir para ponto →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
                {todayAtt.map((a, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-gray-800 truncate">
                      {(a.employees as { full_name: string } | null)?.full_name ?? '—'}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 shrink-0 ${ATT_COLORS[a.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {ATT_LABELS[a.status] ?? a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pendências + Aniversários */}
        <div className="space-y-4">
          {/* Aprovações pendentes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" /> Aprovações pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {approvals.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" /> Tudo em dia!
                </div>
              ) : (
                <div className="space-y-2">
                  {approvals.map(a => (
                    <Link key={a.id} href="/workflows"
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{a.type}</p>
                        <p className="text-xs text-gray-400">
                          {(a.requester as { full_name: string } | null)?.full_name} · {new Date(a.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Aniversários */}
          {birthdays.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gift className="h-4 w-4 text-pink-500" /> Aniversários (30 dias)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {birthdays.map(b => (
                    <div key={b.id} className="flex items-center justify-between">
                      <span className="text-sm text-gray-800">{b.full_name}</span>
                      <span className="text-xs text-pink-600 font-medium">
                        {(b as any).days === 0 ? '🎂 Hoje!' : `em ${(b as any).days}d`}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Férias da equipe */}
      {vacations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Palmtree className="h-4 w-4 text-orange-500" /> Férias da Equipe (próximos 30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-gray-400 border-b">
                    <th className="text-left py-2 pr-4">Colaborador</th>
                    <th className="text-left py-2 pr-4">Início</th>
                    <th className="text-left py-2 pr-4">Fim</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vacations.map((v, i) => {
                    const st = VACA_STATUS[v.status] ?? { label: v.status, color: 'bg-gray-100 text-gray-500' }
                    return (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2.5 pr-4 font-medium">
                          {(v.employees as { full_name: string } | null)?.full_name ?? '—'}
                        </td>
                        <td className="py-2.5 pr-4 text-gray-500">
                          {new Date(v.start_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-2.5 pr-4 text-gray-500">
                          {new Date(v.end_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
