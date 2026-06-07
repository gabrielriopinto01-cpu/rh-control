'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Cake, Palmtree, CalendarDays, Star, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { Label }  from '@/components/ui/label'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export const dynamic = 'force-dynamic'

type EventType = 'vacation' | 'absence' | 'holiday' | 'birthday' | 'event'
type CalEvent  = {
  id: string; date: string; endDate?: string; type: EventType
  label: string; color: string; employeeName?: string; departmentId?: string
}

const TYPE_COLORS: Record<EventType, string> = {
  vacation: '#10b981',
  absence:  '#f59e0b',
  holiday:  '#6366f1',
  birthday: '#ec4899',
  event:    '#2563eb',
}
const TYPE_LABELS: Record<EventType, string> = {
  vacation: 'Férias', absence: 'Ausência', holiday: 'Feriado',
  birthday: 'Aniversário', event: 'Evento',
}

const BR_HOLIDAYS: Record<string, string> = {
  '01-01': 'Confraternização Universal',
  '04-21': 'Tiradentes',
  '05-01': 'Dia do Trabalho',
  '09-07': 'Independência do Brasil',
  '10-12': 'Nossa Sra. Aparecida',
  '11-02': 'Finados',
  '11-15': 'Proclamação da República',
  '11-20': 'Consciência Negra',
  '12-25': 'Natal',
}

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DAY_NAMES   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function toYMD(d: Date) { return d.toISOString().slice(0, 10) }
function expandRange(start: string, end: string) {
  const dates: string[] = []
  const cur = new Date(start + 'T12:00:00')
  const fin = new Date(end   + 'T12:00:00')
  while (cur <= fin) { dates.push(toYMD(cur)); cur.setDate(cur.getDate() + 1) }
  return dates
}

export default function CalendarioPage() {
  const { user }    = useAuth()
  const today       = new Date()
  const [year,      setYear]      = useState(today.getFullYear())
  const [month,     setMonth]     = useState(today.getMonth())
  const [events,    setEvents]    = useState<CalEvent[]>([])
  const [view,      setView]      = useState<'month' | 'week'>('month')
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d
  })
  const [filter,    setFilter]    = useState<EventType | 'all'>('all')
  const [deptFilter, setDeptFilter] = useState('all')
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [selected,  setSelected]  = useState<string | null>(null)
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [newEvent,  setNewEvent]  = useState({ title: '', date: '', end_date: '', type: 'event', color: '#2563eb', department_id: '' })
  const [saving,    setSaving]    = useState(false)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) return
    const supabase = createClient()
    const y = year, m = month
    const startOfMonth = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const endOfMonth   = `${y}-${String(m + 1).padStart(2, '0')}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, '0')}`

    const [vacRes, absRes, empRes, evtRes, deptRes] = await Promise.all([
      supabase.from('vacations').select('id, start_date, end_date, employee:employees(id, full_name, department_id)')
        .eq('company_id', user.company_id).eq('status', 'approved')
        .lte('start_date', endOfMonth).gte('end_date', startOfMonth),
      supabase.from('attendance').select('id, date, employee:employees(id, full_name, department_id)')
        .eq('company_id', user.company_id).eq('type', 'absence')
        .gte('date', startOfMonth).lte('date', endOfMonth),
      supabase.from('employees').select('id, full_name, birth_date, department_id')
        .eq('company_id', user.company_id).eq('status', 'active').not('birth_date', 'is', null),
      supabase.from('calendar_events').select('id, title, date, end_date, type, color, department_id')
        .eq('company_id', user.company_id)
        .gte('date', startOfMonth).lte('date', endOfMonth),
      supabase.from('departments').select('id, name').eq('company_id', user.company_id).order('name'),
    ])

    setDepartments((deptRes.data as any[]) ?? [])

    const collected: CalEvent[] = []

    // Férias
    ;(vacRes.data ?? []).forEach((v: any) => {
      collected.push({
        id: v.id, date: v.start_date, endDate: v.end_date, type: 'vacation',
        label: `Férias — ${v.employee?.full_name}`,
        color: TYPE_COLORS.vacation,
        employeeName: v.employee?.full_name,
        departmentId: v.employee?.department_id,
      })
    })

    // Ausências
    ;(absRes.data ?? []).forEach((a: any) => {
      collected.push({
        id: a.id, date: a.date, type: 'absence',
        label: `Ausência — ${a.employee?.full_name}`,
        color: TYPE_COLORS.absence,
        employeeName: a.employee?.full_name,
        departmentId: a.employee?.department_id,
      })
    })

    // Aniversários (mês atual)
    ;(empRes.data ?? []).forEach((e: any) => {
      if (!e.birth_date) return
      const bd = e.birth_date as string // YYYY-MM-DD
      const mmdd = bd.slice(5)
      const fullDate = `${y}-${mmdd}`
      const bMonth = parseInt(bd.slice(5, 7)) - 1
      if (bMonth === m) {
        collected.push({
          id: `birthday-${e.id}`, date: fullDate, type: 'birthday',
          label: `🎂 ${e.full_name}`,
          color: TYPE_COLORS.birthday,
          employeeName: e.full_name,
          departmentId: e.department_id,
        })
      }
    })

    // Feriados nacionais
    Object.entries(BR_HOLIDAYS).forEach(([mmdd, name]) => {
      const [hm] = mmdd.split('-')
      if (parseInt(hm) - 1 === m) {
        collected.push({
          id: `holiday-${mmdd}`, date: `${y}-${mmdd}`, type: 'holiday',
          label: name, color: TYPE_COLORS.holiday,
        })
      }
    })

    // Eventos internos
    ;(evtRes.data ?? []).forEach((ev: any) => {
      collected.push({
        id: ev.id, date: ev.date, endDate: ev.end_date, type: ev.type as EventType,
        label: ev.title, color: ev.color ?? TYPE_COLORS.event,
        departmentId: ev.department_id,
      })
    })

    setEvents(collected)
  }, [user, year, month])

  useEffect(() => { load() }, [load])

  // Mapeia eventos por dia
  const eventsByDay: Record<string, CalEvent[]> = {}
  const visibleEvents = events.filter(ev =>
    (filter === 'all' || ev.type === filter) &&
    (deptFilter === 'all' || !ev.departmentId || ev.departmentId === deptFilter)
  )
  visibleEvents.forEach(ev => {
    const days = ev.endDate ? expandRange(ev.date, ev.endDate) : [ev.date]
    days.forEach(d => {
      if (!eventsByDay[d]) eventsByDay[d] = []
      eventsByDay[d].push(ev)
    })
  })

  // Navegação
  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }
  const prevWeek  = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }
  const nextWeek  = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }

  // Células do mês
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay    = new Date(year, month, 1).getDay()
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  // Dias da semana (view week)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d
  })

  const saveEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEvent.title || !newEvent.date) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('calendar_events').insert({
      company_id:    user!.company_id,
      title:         newEvent.title,
      date:          newEvent.date,
      end_date:      newEvent.end_date || null,
      type:          newEvent.type,
      color:         newEvent.color,
      department_id: newEvent.department_id || null,
      created_by:    user!.id,
    })
    setSaving(false)
    setShowNewEvent(false)
    setNewEvent({ title: '', date: '', end_date: '', type: 'event', color: '#2563eb', department_id: '' })
    load()
  }

  const selectedEvents = selected ? (eventsByDay[selected] ?? []) : []

  return (
    <div className="space-y-5 p-1">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendário de Equipe</h1>
          <p className="text-gray-500 text-sm">Férias, aniversários, feriados e eventos</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(['month', 'week'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${view === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {v === 'month' ? 'Mês' : 'Semana'}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setShowNewEvent(true)}>
            <Plus className="h-4 w-4 mr-1" /> Evento
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-wrap gap-2 items-center">
        <Filter className="h-4 w-4 text-gray-400" />
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'vacation', 'absence', 'holiday', 'birthday', 'event'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                filter === f ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}>
              {f === 'all' ? 'Todos' : TYPE_LABELS[f]}
            </button>
          ))}
        </div>
        {departments.length > 0 && (
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
            className="ml-auto border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600">
            <option value="all">Todos os depts.</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Calendário */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Navegação */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <button onClick={view === 'month' ? prevMonth : prevWeek} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <h2 className="text-base font-bold text-gray-900">
              {view === 'month'
                ? `${MONTH_NAMES[month]} ${year}`
                : `${weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — ${weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`
              }
            </h2>
            <button onClick={view === 'month' ? nextMonth : nextWeek} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          {/* Header dias */}
          <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-400 border-b border-gray-100">
            {DAY_NAMES.map(d => <div key={d} className="py-2">{d}</div>)}
          </div>

          {/* VIEW MÊNSAL */}
          {view === 'month' && (
            <div className="grid grid-cols-7">
              {cells.map((day, i) => {
                if (!day) return <div key={`e-${i}`} className="min-h-[80px] border-b border-r border-gray-100 bg-gray-50/40" />
                const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const dayEvs = eventsByDay[key] ?? []
                const isToday = key === toYMD(today)
                const isSelected = key === selected
                const isWeekend = new Date(key + 'T12:00:00').getDay() % 6 === 0
                return (
                  <div key={key}
                    onClick={() => setSelected(isSelected ? null : key)}
                    className={`min-h-[80px] border-b border-r border-gray-100 p-1.5 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50' : isWeekend ? 'bg-gray-50/60' : 'hover:bg-gray-50'
                    }`}>
                    <div className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold mb-1 ${
                      isToday ? 'bg-blue-600 text-white' : 'text-gray-700'
                    }`}>{day}</div>
                    <div className="space-y-0.5">
                      {dayEvs.slice(0, 2).map(ev => (
                        <div key={ev.id}
                          style={{ borderLeft: `2px solid ${ev.color}`, backgroundColor: ev.color + '18' }}
                          className="rounded text-xs px-1 py-0.5 truncate">
                          <span style={{ color: ev.color }} className="font-medium">
                            {ev.type === 'birthday' ? '🎂' : ''} {ev.employeeName ?? ev.label}
                          </span>
                        </div>
                      ))}
                      {dayEvs.length > 2 && (
                        <p className="text-xs text-gray-400 pl-1">+{dayEvs.length - 2}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* VIEW SEMANAL */}
          {view === 'week' && (
            <div className="grid grid-cols-7">
              {weekDays.map((day, i) => {
                const key = toYMD(day)
                const dayEvs = eventsByDay[key] ?? []
                const isToday = key === toYMD(today)
                const isSelected = key === selected
                const isWeekend = day.getDay() % 6 === 0
                return (
                  <div key={key}
                    onClick={() => setSelected(isSelected ? null : key)}
                    className={`min-h-[200px] border-r border-gray-100 p-2 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50' : isWeekend ? 'bg-gray-50' : 'hover:bg-gray-50'
                    }`}>
                    <div className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-semibold mb-2 ${
                      isToday ? 'bg-blue-600 text-white' : 'text-gray-700'
                    }`}>{day.getDate()}</div>
                    <div className="space-y-1">
                      {dayEvs.map(ev => (
                        <div key={ev.id}
                          style={{ borderLeft: `3px solid ${ev.color}`, backgroundColor: ev.color + '18' }}
                          className="rounded-r px-2 py-1.5">
                          <p style={{ color: ev.color }} className="text-xs font-semibold truncate">
                            {TYPE_LABELS[ev.type]}
                          </p>
                          <p className="text-xs text-gray-600 truncate">{ev.employeeName ?? ev.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Painel lateral */}
        <div className="space-y-4">
          {/* Legenda */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Legenda</h3>
            <div className="space-y-2">
              {(Object.entries(TYPE_LABELS) as [EventType, string][]).map(([t, l]) => (
                <div key={t} className="flex items-center gap-2 text-sm">
                  <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: TYPE_COLORS[t] }} />
                  <span className="text-gray-600">{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Eventos do dia */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">
              {selected
                ? new Date(selected + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
                : 'Selecione um dia'}
            </h3>
            {!selected && <p className="text-sm text-gray-400">Clique em um dia para ver os eventos</p>}
            {selected && selectedEvents.length === 0 && <p className="text-sm text-gray-400">Nenhum evento neste dia</p>}
            <div className="space-y-2">
              {selectedEvents.map(ev => (
                <div key={ev.id} style={{ borderLeft: `3px solid ${ev.color}` }} className="pl-3 py-1">
                  <p className="text-sm font-medium text-gray-800">{ev.label}</p>
                  <p className="text-xs text-gray-400">{TYPE_LABELS[ev.type]}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Resumo */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Resumo do mês</h3>
            <div className="space-y-2 text-sm">
              {(Object.entries(TYPE_LABELS) as [EventType, string][]).map(([t, l]) => {
                const count = Object.values(eventsByDay).flat().filter((e, _, arr) => {
                  const seen = new Set(); if (seen.has(e.id)) return false; seen.add(e.id); return e.type === t
                }).length
                if (count === 0) return null
                return (
                  <div key={t} className="flex justify-between items-center">
                    <span className="text-gray-500">{l}</span>
                    <span className="font-semibold" style={{ color: TYPE_COLORS[t] }}>{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal novo evento */}
      {showNewEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowNewEvent(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900">Novo evento</h3>
              <button onClick={() => setShowNewEvent(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={saveEvent} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Título *</Label>
                <Input placeholder="Ex: Reunião de líderes" value={newEvent.title}
                  onChange={e => setNewEvent(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Data início *</Label>
                  <Input type="date" value={newEvent.date}
                    onChange={e => setNewEvent(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Data fim</Label>
                  <Input type="date" value={newEvent.end_date}
                    onChange={e => setNewEvent(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <select value={newEvent.type} onChange={e => setNewEvent(f => ({ ...f, type: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="event">Evento</option>
                    <option value="holiday">Feriado local</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Cor</Label>
                  <Input type="color" value={newEvent.color}
                    onChange={e => setNewEvent(f => ({ ...f, color: e.target.value }))}
                    className="h-10 px-2 py-1 cursor-pointer" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Departamento <span className="text-gray-400">(opcional)</span></Label>
                <select value={newEvent.department_id} onChange={e => setNewEvent(f => ({ ...f, department_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Todos</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <Button type="button" variant="outline" onClick={() => setShowNewEvent(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? '...' : 'Criar evento'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
