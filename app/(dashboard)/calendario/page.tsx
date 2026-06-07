'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Users, Palmtree, Clock, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export const dynamic = 'force-dynamic'

type EventType = 'vacation' | 'absence' | 'holiday'
type CalEvent = {
  id: string
  date: string       // YYYY-MM-DD
  endDate?: string   // YYYY-MM-DD (para férias)
  type: EventType
  label: string
  color: string
  employeeId?: string
  employeeName?: string
}

const BR_HOLIDAYS_2025: CalEvent[] = [
  { id: 'h1',  date: '2025-01-01', type: 'holiday', label: 'Confraternização Universal', color: '#6366f1' },
  { id: 'h2',  date: '2025-04-18', type: 'holiday', label: 'Sexta-feira Santa',          color: '#6366f1' },
  { id: 'h3',  date: '2025-04-21', type: 'holiday', label: 'Tiradentes',                 color: '#6366f1' },
  { id: 'h4',  date: '2025-05-01', type: 'holiday', label: 'Dia do Trabalho',            color: '#6366f1' },
  { id: 'h5',  date: '2025-06-19', type: 'holiday', label: 'Corpus Christi',             color: '#6366f1' },
  { id: 'h6',  date: '2025-09-07', type: 'holiday', label: 'Independência do Brasil',    color: '#6366f1' },
  { id: 'h7',  date: '2025-10-12', type: 'holiday', label: 'Nossa Sra. Aparecida',       color: '#6366f1' },
  { id: 'h8',  date: '2025-11-02', type: 'holiday', label: 'Finados',                    color: '#6366f1' },
  { id: 'h9',  date: '2025-11-15', type: 'holiday', label: 'Proclamação da República',   color: '#6366f1' },
  { id: 'h10', date: '2025-11-20', type: 'holiday', label: 'Consciência Negra',          color: '#6366f1' },
  { id: 'h11', date: '2025-12-25', type: 'holiday', label: 'Natal',                      color: '#6366f1' },
]

const TYPE_COLORS: Record<EventType, string> = {
  vacation: '#10b981',
  absence:  '#f59e0b',
  holiday:  '#6366f1',
}

const TYPE_LABELS: Record<EventType, string> = {
  vacation: 'Férias',
  absence:  'Ausência',
  holiday:  'Feriado',
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay() // 0=Sun
}
function toYMD(d: Date) {
  return d.toISOString().slice(0, 10)
}
function expandRange(start: string, end: string): string[] {
  const dates: string[] = []
  const cur = new Date(start + 'T12:00:00')
  const fin = new Date(end   + 'T12:00:00')
  while (cur <= fin) {
    dates.push(toYMD(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DAY_NAMES   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

export default function CalendarioPage() {
  const { user } = useAuth()
  const today    = new Date()
  const [year,   setYear]   = useState(today.getFullYear())
  const [month,  setMonth]  = useState(today.getMonth())
  const [events, setEvents] = useState<CalEvent[]>([])
  const [filter, setFilter] = useState<EventType | 'all'>('all')
  const [selected, setSelected] = useState<string | null>(null) // YYYY-MM-DD

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) return
    const supabase = createClient()

    const startOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endOfMonth   = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth(year, month)).padStart(2, '0')}`

    // Férias aprovadas
    const { data: vacations } = await supabase
      .from('vacations')
      .select('id, start_date, end_date, employee:employees(id, full_name)')
      .eq('company_id', user.company_id)
      .eq('status', 'approved')
      .lte('start_date', endOfMonth)
      .gte('end_date',   startOfMonth)

    const vacationEvents: CalEvent[] = (vacations ?? []).map((v: any) => ({
      id:           v.id,
      date:         v.start_date,
      endDate:      v.end_date,
      type:         'vacation',
      label:        `Férias — ${v.employee?.full_name ?? '?'}`,
      color:        TYPE_COLORS.vacation,
      employeeId:   v.employee?.id,
      employeeName: v.employee?.full_name,
    }))

    // Ausências (marcação de ponto com tipo absence)
    const { data: absences } = await supabase
      .from('attendance')
      .select('id, date, employee:employees(id, full_name)')
      .eq('company_id', user.company_id)
      .eq('type', 'absence')
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)

    const absenceEvents: CalEvent[] = (absences ?? []).map((a: any) => ({
      id:           a.id,
      date:         a.date,
      type:         'absence',
      label:        `Ausência — ${a.employee?.full_name ?? '?'}`,
      color:        TYPE_COLORS.absence,
      employeeId:   a.employee?.id,
      employeeName: a.employee?.full_name,
    }))

    // Feriados fixos para o ano
    const yearHolidays = BR_HOLIDAYS_2025.map(h => ({
      ...h, date: h.date.replace('2025', String(year))
    })).filter(h => {
      const m = parseInt(h.date.split('-')[1]) - 1
      return m === month
    })

    setEvents([...vacationEvents, ...absenceEvents, ...yearHolidays])
  }, [user, year, month])

  useEffect(() => { load() }, [load])

  // Mapeia eventos por dia
  const eventsByDay: Record<string, CalEvent[]> = {}
  events.forEach(ev => {
    if (ev.endDate) {
      expandRange(ev.date, ev.endDate).forEach(d => {
        if (!eventsByDay[d]) eventsByDay[d] = []
        eventsByDay[d].push(ev)
      })
    } else {
      if (!eventsByDay[ev.date]) eventsByDay[ev.date] = []
      eventsByDay[ev.date].push(ev)
    }
  })

  const days = daysInMonth(year, month)
  const firstDay = firstDayOfMonth(year, month)
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ]

  const selectedDateKey = selected
  const selectedEvents = selectedDateKey ? (eventsByDay[selectedDateKey] ?? []) : []

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const filteredByType = (evs: CalEvent[]) =>
    filter === 'all' ? evs : evs.filter(e => e.type === filter)

  return (
    <div className="space-y-5 p-1">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendário de Equipe</h1>
          <p className="text-gray-500 text-sm mt-0.5">Férias, ausências e feriados num só lugar</p>
        </div>
        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'vacation', 'absence', 'holiday'] as const).map(f => (
            <button key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filter === f ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {f === 'all' ? 'Todos' : TYPE_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendário */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <h2 className="text-lg font-bold text-gray-900">
              {MONTH_NAMES[month]} {year}
            </h2>
            <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          {/* Grade */}
          <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-400 border-b border-gray-100">
            {DAY_NAMES.map(d => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-gray-100" />
              const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayEvents = filteredByType(eventsByDay[key] ?? [])
              const isToday = key === toYMD(today)
              const isSelected = key === selectedDateKey
              const isWeekend = new Date(key + 'T12:00:00').getDay() % 6 === 0

              return (
                <div key={key}
                  onClick={() => setSelected(isSelected ? null : key)}
                  className={`min-h-[80px] border-b border-r border-gray-100 p-1.5 cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50' :
                    isWeekend  ? 'bg-gray-50/60' :
                    'hover:bg-gray-50'
                  }`}
                >
                  <div className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold mb-1 ${
                    isToday ? 'bg-blue-600 text-white' : 'text-gray-700'
                  }`}>{day}</div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 2).map(ev => (
                      <div key={ev.id}
                        style={{ backgroundColor: ev.color + '22', borderLeft: `2px solid ${ev.color}` }}
                        className="rounded text-xs px-1 py-0.5 truncate font-medium"
                        style2={{ color: ev.color }}
                      >
                        <span style={{ color: ev.color }} className="text-xs leading-tight truncate block">
                          {ev.employeeName ?? ev.label}
                        </span>
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <p className="text-xs text-gray-400 pl-1">+{dayEvents.length - 2} mais</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Painel lateral */}
        <div className="space-y-4">
          {/* Legenda */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Legenda</h3>
            <div className="space-y-2">
              {(['vacation', 'absence', 'holiday'] as EventType[]).map(t => (
                <div key={t} className="flex items-center gap-2 text-sm">
                  <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: TYPE_COLORS[t] }} />
                  <span className="text-gray-600">{TYPE_LABELS[t]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Eventos do dia selecionado */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">
              {selected
                ? new Date(selected + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
                : 'Selecione um dia'}
            </h3>
            {!selected && (
              <p className="text-sm text-gray-400">Clique em qualquer dia do calendário para ver os eventos</p>
            )}
            {selected && selectedEvents.length === 0 && (
              <p className="text-sm text-gray-400">Nenhum evento neste dia</p>
            )}
            <div className="space-y-2">
              {selectedEvents.map(ev => (
                <div key={ev.id}
                  style={{ borderLeft: `3px solid ${ev.color}` }}
                  className="pl-3 py-1"
                >
                  <p className="text-sm font-medium text-gray-800">{ev.label}</p>
                  <p className="text-xs text-gray-400 capitalize">{TYPE_LABELS[ev.type]}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Resumo do mês */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Resumo do mês</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Férias</span>
                <span className="font-medium text-green-600">
                  {new Set(events.filter(e => e.type === 'vacation').map(e => e.employeeId)).size} colaboradores
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Ausências</span>
                <span className="font-medium text-amber-600">
                  {events.filter(e => e.type === 'absence').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Feriados</span>
                <span className="font-medium text-indigo-600">
                  {events.filter(e => e.type === 'holiday').length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
