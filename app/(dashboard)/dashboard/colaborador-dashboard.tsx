'use client'

import { useEffect, useState, useCallback } from 'react'
import { Palmtree, Clock, Receipt, GraduationCap, Cake, CheckCircle2, AlertCircle, Loader2, TrendingUp } from 'lucide-react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export const dynamic = 'force-dynamic'

type ColabData = {
  employee: { full_name: string; hire_date: string; position?: string; department?: string } | null
  vacationBalance: number
  vacationPending: number
  lastPayroll: { reference_month: string; net_salary: number } | null
  todayAttendance: { clock_in: string | null; clock_out: string | null; status: string } | null
  unreadAnnouncements: number
  pendingTrainings: number
  upcomingBirthdays: { full_name: string; daysUntil: number }[]
  pendingRequests: number
  lastReview: { score: number | null; period: string } | null
}

function brl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function daysWorked(hireDate: string) {
  return Math.floor((Date.now() - new Date(hireDate + 'T00:00:00').getTime()) / 86400000)
}

export default function ColaboradorDashboard() {
  const { user } = useAuth()
  const [data,    setData]    = useState<ColabData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const supabase = createClient()
    const today    = new Date().toISOString().slice(0, 10)
    const monthStart = today.slice(0, 7) + '-01'

    const [empRes, vacRes, payRes, attRes, annRes, trainRes, birthRes, reqRes, revRes] = await Promise.allSettled([
      // Dados do colaborador
      supabase.from('employees')
        .select('full_name, hire_date, position:positions(title), department:departments(name)')
        .eq('company_id', user.company_id)
        .eq('profile_id', user.id)
        .maybeSingle(),

      // Férias
      supabase.from('vacations')
        .select('status, days, start_date, end_date')
        .eq('company_id', user.company_id)
        .eq('employee_id', user.employee_id ?? '')
        .in('status', ['approved', 'taken', 'pending']),

      // Último holerite
      supabase.from('payroll_items')
        .select('net_salary, payroll:payrolls(reference_month)')
        .eq('company_id', user.company_id)
        .eq('employee_id', user.employee_id ?? '')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Ponto hoje
      supabase.from('attendance_records')
        .select('clock_in, clock_out, status')
        .eq('employee_id', user.employee_id ?? '')
        .eq('date', today)
        .maybeSingle(),

      // Comunicados não lidos
      supabase.from('announcement_reads')
        .select('id')
        .eq('profile_id', user.id),

      // Treinamentos pendentes (empresa - concluídos pelo colaborador)
      supabase.from('trainings')
        .select('id')
        .eq('company_id', user.company_id)
        .eq('is_mandatory', true),

      // Aniversariantes próximos (empresa toda)
      supabase.from('employees')
        .select('full_name, birth_date')
        .eq('company_id', user.company_id)
        .eq('status', 'active')
        .not('birth_date', 'is', null),

      // Minhas solicitações pendentes
      supabase.from('approval_requests')
        .select('id')
        .eq('company_id', user.company_id)
        .eq('employee_id', user.employee_id ?? '')
        .eq('status', 'pending'),

      // Última avaliação
      supabase.from('performance_reviews')
        .select('score, period')
        .eq('company_id', user.company_id)
        .eq('employee_id', user.employee_id ?? '')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const emp     = empRes.status === 'fulfilled' ? empRes.value.data : null
    const vacs    = vacRes.status === 'fulfilled' ? (vacRes.value.data ?? []) : []
    const payItem = payRes.status === 'fulfilled' ? payRes.value.data : null
    const att     = attRes.status === 'fulfilled' ? attRes.value.data : null
    const reads   = annRes.status === 'fulfilled' ? (annRes.value.data ?? []) : []
    const trainings = trainRes.status === 'fulfilled' ? (trainRes.value.data ?? []) : []
    const birthEmps = birthRes.status === 'fulfilled' ? (birthRes.value.data ?? []) : []
    const reqs    = reqRes.status === 'fulfilled' ? (reqRes.value.data ?? []) : []
    const rev     = revRes.status === 'fulfilled' ? revRes.value.data : null

    // Saldo de férias CLT
    const hireDate = emp?.hire_date ?? today
    const monthsWorked = Math.floor((Date.now() - new Date(hireDate + 'T00:00:00').getTime()) / (30.44 * 86400000))
    const daysEarned = Math.floor(monthsWorked / 12) * 30
    const daysUsed = vacs.filter(v => v.status === 'approved' || v.status === 'taken').reduce((s, v) => s + (v.days ?? 0), 0)
    const vacBalance = Math.max(0, daysEarned - daysUsed)
    const vacPending = vacs.filter(v => v.status === 'pending').length

    // Aniversariantes próximos (7 dias)
    const upcomingBirthdays = birthEmps.flatMap(e => {
      if (!e.birth_date || e.full_name === emp?.full_name) return []
      const d = new Date(e.birth_date + 'T00:00:00')
      const next = new Date(new Date().getFullYear(), d.getMonth(), d.getDate())
      const diff = Math.round((next.getTime() - new Date().setHours(0,0,0,0)) / 86400000)
      if (diff >= 0 && diff <= 7) return [{ full_name: e.full_name, daysUntil: diff }]
      return []
    }).sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 3)

    // Treinamentos obrigatórios não concluídos — simplificado
    const pendingTrainings = Math.max(0, trainings.length - reads.length)

    setData({
      employee: emp ? {
        full_name:  emp.full_name,
        hire_date:  emp.hire_date,
        position:   (emp.position as any)?.title,
        department: (emp.department as any)?.name,
      } : null,
      vacationBalance:     vacBalance,
      vacationPending:     vacPending,
      lastPayroll:         payItem ? { reference_month: (payItem.payroll as any)?.reference_month ?? '', net_salary: payItem.net_salary } : null,
      todayAttendance:     att,
      unreadAnnouncements: 0, // simplificado — evita join complexo
      pendingTrainings:    Math.max(0, trainings.length),
      upcomingBirthdays,
      pendingRequests:     reqs.length,
      lastReview:          rev ? { score: rev.score, period: rev.period } : null,
    })
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  const emp  = data?.employee
  const days = emp?.hire_date ? daysWorked(emp.hire_date) : 0
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)

  return (
    <div className="space-y-6">
      {/* Header pessoal */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-indigo-200 text-sm">Bem-vindo(a) de volta!</p>
            <h1 className="text-2xl font-bold mt-0.5">{emp?.full_name ?? user?.full_name}</h1>
            {emp?.position && (
              <p className="text-indigo-200 text-sm mt-1">{emp.position}{emp.department ? ` · ${emp.department}` : ''}</p>
            )}
          </div>
          <div className="bg-white/20 rounded-xl px-4 py-2 text-right">
            <p className="text-xs text-indigo-200">Tempo de empresa</p>
            <p className="font-bold text-white">
              {years > 0 ? `${years}a ` : ''}{months}m
            </p>
          </div>
        </div>

        {/* Ponto do dia */}
        {data?.todayAttendance ? (
          <div className="mt-4 bg-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-300 shrink-0" />
            <div>
              <p className="text-sm font-medium">Ponto registrado hoje</p>
              <p className="text-xs text-indigo-200">
                Entrada: {data.todayAttendance.clock_in ?? '—'}
                {data.todayAttendance.clock_out ? ` · Saída: ${data.todayAttendance.clock_out}` : ' · Em andamento'}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 bg-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-300 shrink-0" />
            <div>
              <p className="text-sm font-medium">Ponto não registrado hoje</p>
              <p className="text-xs text-indigo-200">Acesse Meu Ponto para registrar sua entrada</p>
            </div>
          </div>
        )}
      </div>

      {/* KPIs pessoais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Saldo de férias',
            value: `${data?.vacationBalance ?? 0} dias`,
            sub:   data?.vacationPending ? `${data.vacationPending} pendente(s)` : 'Disponíveis',
            Icon: Palmtree,
            color: 'text-green-600', bg: 'bg-green-50',
            href: '/minhas-ferias',
          },
          {
            label: 'Último holerite',
            value: data?.lastPayroll ? brl(data.lastPayroll.net_salary) : '—',
            sub:   data?.lastPayroll?.reference_month ?? 'Sem registro',
            Icon: Receipt,
            color: 'text-blue-600', bg: 'bg-blue-50',
            href: '/meus-holerites',
          },
          {
            label: 'Solicitações',
            value: data?.pendingRequests ?? 0,
            sub:   'Pendentes de aprovação',
            Icon: Clock,
            color: 'text-amber-600', bg: 'bg-amber-50',
            href: '/workflows',
          },
          {
            label: 'Última avaliação',
            value: data?.lastReview ? `${data.lastReview.score?.toFixed(1) ?? '—'}/5` : '—',
            sub:   data?.lastReview?.period ?? 'Sem avaliação',
            Icon: TrendingUp,
            color: 'text-purple-600', bg: 'bg-purple-50',
            href: '/minha-avaliacao',
          },
        ].map(({ label, value, sub, Icon, color, bg, href }) => (
          <a key={label} href={href}
            className={`${bg} rounded-xl p-4 hover:scale-[1.02] transition-transform cursor-pointer`}>
            <Icon className={`h-6 w-6 ${color} mb-2`} />
            <p className="text-xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            <p className="text-xs text-gray-400">{sub}</p>
          </a>
        ))}
      </div>

      {/* Linha 2: Aniversários + Atalhos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Aniversariantes da semana */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Cake className="h-4 w-4 text-pink-500" /> Aniversários esta semana
          </h2>
          {data?.upcomingBirthdays.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum aniversário nos próximos 7 dias</p>
          ) : (
            <div className="space-y-2">
              {data?.upcomingBirthdays.map((b, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-pink-100 flex items-center justify-center text-sm">
                      🎂
                    </div>
                    <p className="text-sm font-medium text-gray-800">{b.full_name}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    b.daysUntil === 0 ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {b.daysUntil === 0 ? 'Hoje! 🎉' : `em ${b.daysUntil}d`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Atalhos rápidos */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Acesso rápido</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Registrar ponto',  href: '/meu-ponto',        icon: '⏱️' },
              { label: 'Ver holerites',    href: '/meus-holerites',   icon: '💰' },
              { label: 'Solicitar férias', href: '/minhas-ferias',    icon: '🌴' },
              { label: 'Meus documentos', href: '/meus-documentos',  icon: '📂' },
              { label: 'Treinamentos',     href: '/meus-treinamentos',icon: '📚' },
              { label: 'Meu perfil',       href: '/meu-perfil',       icon: '👤' },
            ].map(({ label, href, icon }) => (
              <a key={href} href={href}
                className="flex items-center gap-2.5 p-2.5 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 transition-colors text-sm text-gray-700 font-medium">
                <span className="text-base">{icon}</span>
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Treinamentos obrigatórios pendentes */}
      {(data?.pendingTrainings ?? 0) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <GraduationCap className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">
              {data?.pendingTrainings} treinamento(s) disponível(is)
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Acesse Treinamentos para ver os conteúdos disponíveis.
            </p>
          </div>
          <a href="/meus-treinamentos"
            className="ml-auto shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900 underline">
            Ver agora
          </a>
        </div>
      )}
    </div>
  )
}
