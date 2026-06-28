'use client'

import { useEffect, useState, useCallback } from 'react'
import { CalendarDays, Plus, Trash2, Loader2, Pencil, Users, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export const dynamic = 'force-dynamic'

type Shift = {
  id: string
  name: string
  start_time: string
  end_time: string
  color: string
  days_of_week: number[]
}

type Assignment = {
  id: string
  employee_id: string
  shift_id: string
  start_date: string
  end_date: string | null
  employee: { full_name: string; position: string | null } | null
  shift: Shift | null
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16']

function nextMonday() {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? 1 : 8 - day))
  return d.toISOString().slice(0, 10)
}

function weekDays(monday: string) {
  const d   = new Date(monday + 'T00:00:00')
  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(d); nd.setDate(d.getDate() + i)
    return nd.toISOString().slice(0, 10)
  })
}

function prevMonday(cur: string) {
  const d = new Date(cur + 'T00:00:00'); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10)
}
function nextMon(cur: string) {
  const d = new Date(cur + 'T00:00:00'); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10)
}

export default function EscalasPage() {
  const { user } = useAuth()
  const [shifts,      setShifts]      = useState<Shift[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [employees,   setEmployees]   = useState<{ id: string; full_name: string }[]>([])
  const [loading,     setLoading]     = useState(true)
  const [weekStart,   setWeekStart]   = useState(() => {
    const d = new Date(); const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    return d.toISOString().slice(0, 10)
  })

  // Dialogs
  const [shiftOpen,  setShiftOpen]  = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [saving,     setSaving]     = useState(false)

  // Form turno
  const [fName,  setFName]  = useState(''); const [fStart, setFStart] = useState('08:00')
  const [fEnd,   setFEnd]   = useState('17:00'); const [fColor, setFColor] = useState(COLORS[0])
  const [fDays,  setFDays]  = useState<number[]>([1,2,3,4,5])
  const [editShift, setEditShift] = useState<Shift | null>(null)

  // Form atribuição
  const [aEmp,    setAEmp]    = useState(''); const [aShift,  setAShift]  = useState('')
  const [aStart,  setAStart]  = useState(new Date().toISOString().slice(0,10))
  const [aEnd,    setAEnd]    = useState('')

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user?.company_id) { setLoading(false); return }
    setLoading(true)
    const supabase = createClient()
    const days = weekDays(weekStart)

    const [shRes, asRes, empRes] = await Promise.all([
      supabase.from('work_shifts').select('*').eq('company_id', user.company_id).order('name'),
      supabase.from('shift_assignments').select('*, employee:employees(full_name,position), shift:work_shifts(*)')
        .eq('company_id', user.company_id)
        .lte('start_date', days[6])
        .or(`end_date.is.null,end_date.gte.${days[0]}`),
      supabase.from('employees').select('id, full_name').eq('company_id', user.company_id).eq('status','active').order('full_name'),
    ])

    setShifts((shRes.data ?? []) as Shift[])
    setAssignments((asRes.data ?? []) as unknown as Assignment[])
    setEmployees(empRes.data ?? [])
    setLoading(false)
  }, [user, weekStart])

  useEffect(() => { load() }, [load])

  async function saveShift() {
    if (!fName || !fStart || !fEnd) { toast.error('Preencha nome e horários'); return }
    setSaving(true)
    const supabase = createClient()
    const payload = { company_id: user!.company_id, name: fName, start_time: fStart, end_time: fEnd, color: fColor, days_of_week: fDays }
    const { error } = editShift
      ? await supabase.from('work_shifts').update(payload).eq('id', editShift.id)
      : await supabase.from('work_shifts').insert(payload)
    if (error) {
      toast.error(error.message.includes('does not exist') ? 'Execute a migração SQL (20260628_escalas.sql)' : error.message)
    } else {
      toast.success(editShift ? 'Turno atualizado!' : 'Turno criado!')
      setShiftOpen(false); setFName(''); setEditShift(null); load()
    }
    setSaving(false)
  }

  async function deleteShift(id: string) {
    const supabase = createClient()
    await supabase.from('work_shifts').delete().eq('id', id)
    toast.success('Turno removido'); load()
  }

  async function saveAssignment() {
    if (!aEmp || !aShift || !aStart) { toast.error('Preencha colaborador, turno e data de início'); return }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('shift_assignments').insert({
      company_id: user!.company_id, employee_id: aEmp, shift_id: aShift,
      start_date: aStart, end_date: aEnd || null,
    })
    if (error) {
      toast.error(error.message.includes('does not exist') ? 'Execute a migração SQL (20260628_escalas.sql)' : error.message)
    } else {
      toast.success('Escala atribuída!'); setAssignOpen(false); setAEmp(''); load()
    }
    setSaving(false)
  }

  async function removeAssignment(id: string) {
    const supabase = createClient()
    await supabase.from('shift_assignments').delete().eq('id', id)
    toast.success('Atribuição removida'); load()
  }

  function toggleDay(d: number) {
    setFDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort())
  }

  const days = weekDays(weekStart)

  // Monta a grade: colaboradores × dias da semana
  const assignedEmpIds = new Set(assignments.map(a => a.employee_id))
  const weekEmployees  = employees.filter(e => assignedEmpIds.has(e.id))

  function getAssignment(empId: string, dateStr: string): Assignment | undefined {
    const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay()
    return assignments.find(a =>
      a.employee_id === empId &&
      a.start_date <= dateStr &&
      (!a.end_date || a.end_date >= dateStr) &&
      (a.shift?.days_of_week?.includes(dayOfWeek) ?? true)
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6" /> Escalas de Trabalho
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie turnos e escalas semanais da equipe</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setEditShift(null); setFName(''); setFStart('08:00'); setFEnd('17:00'); setFColor(COLORS[0]); setFDays([1,2,3,4,5]); setShiftOpen(true) }}>
            <Clock className="h-3.5 w-3.5" /> Novo turno
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setAssignOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Atribuir escala
          </Button>
        </div>
      </div>

      {/* Turnos cadastrados */}
      <div className="bg-white border rounded-xl p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Turnos cadastrados</p>
        {shifts.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum turno cadastrado. Crie um turno para começar.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {shifts.map(s => (
              <div key={s.id} className="flex items-center gap-2 border rounded-lg px-3 py-2">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-sm font-medium">{s.name}</span>
                <span className="text-xs text-gray-400">{s.start_time}–{s.end_time}</span>
                <span className="text-xs text-gray-300">|</span>
                <span className="text-xs text-gray-400">{s.days_of_week?.map((d: number) => WEEKDAYS[d]).join(', ')}</span>
                <button onClick={() => { setEditShift(s); setFName(s.name); setFStart(s.start_time); setFEnd(s.end_time); setFColor(s.color); setFDays(s.days_of_week ?? []); setShiftOpen(true) }}>
                  <Pencil className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
                </button>
                <button onClick={() => deleteShift(s.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grade semanal */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        {/* Navegação */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-gray-50">
          <button onClick={() => setWeekStart(prevMonday(weekStart))} className="p-1.5 border rounded-md hover:bg-white text-sm">◀</button>
          <span className="text-sm font-medium">
            {new Date(days[0] + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} –{' '}
            {new Date(days[6] + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
          <button onClick={() => setWeekStart(nextMon(weekStart))} className="p-1.5 border rounded-md hover:bg-white text-sm">▶</button>
          <button onClick={() => {
            const d = new Date(); const day = d.getDay()
            d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
            setWeekStart(d.toISOString().slice(0, 10))
          }} className="ml-auto text-xs text-blue-600 hover:underline">Semana atual</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : weekEmployees.length === 0 ? (
          <div className="py-14 text-center text-gray-400">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhuma escala atribuída nesta semana</p>
            <button onClick={() => setAssignOpen(true)} className="mt-2 text-sm text-blue-500 hover:underline">Atribuir escala →</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="text-left px-4 py-2.5 min-w-40 sticky left-0 bg-slate-800 z-10 border-r border-slate-700">Colaborador</th>
                  {days.map((d, i) => {
                    const isToday = d === new Date().toISOString().slice(0, 10)
                    return (
                      <th key={d} className={`text-center px-2 py-2.5 min-w-24 text-xs ${isToday ? 'bg-blue-700' : ''}`}>
                        <div>{WEEKDAYS[i]}</div>
                        <div className="font-normal opacity-75">{new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</div>
                      </th>
                    )
                  })}
                  <th className="px-3 py-2.5 text-xs text-center min-w-16">Ações</th>
                </tr>
              </thead>
              <tbody>
                {weekEmployees.map((e, ri) => (
                  <tr key={e.id} className={`border-b ${ri % 2 === 0 ? '' : 'bg-gray-50'}`}>
                    <td className={`px-4 py-2.5 font-medium text-gray-900 sticky left-0 z-10 border-r ${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      {e.full_name}
                    </td>
                    {days.map(d => {
                      const asgn = getAssignment(e.id, d)
                      const sh   = asgn?.shift
                      return (
                        <td key={d} className="px-1 py-1.5 text-center">
                          {sh ? (
                            <div className="text-xs rounded-md px-2 py-1 font-medium" style={{ background: sh.color + '20', color: sh.color, border: `1px solid ${sh.color}40` }}>
                              <div>{sh.name}</div>
                              <div className="opacity-75">{sh.start_time}–{sh.end_time}</div>
                            </div>
                          ) : (
                            <span className="text-gray-200">—</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-3 py-2 text-center">
                      {assignments.filter(a => a.employee_id === e.id).map(a => (
                        <button key={a.id} onClick={() => removeAssignment(a.id)} title="Remover escala">
                          <Trash2 className="h-3.5 w-3.5 text-gray-300 hover:text-red-500" />
                        </button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal criar/editar turno */}
      <Dialog open={shiftOpen} onOpenChange={setShiftOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editShift ? 'Editar turno' : 'Novo turno'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5"><Label>Nome *</Label><Input value={fName} onChange={e => setFName(e.target.value)} placeholder="Ex: Manhã, Tarde, Noite" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Entrada *</Label><input type="time" value={fStart} onChange={e => setFStart(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
              <div className="space-y-1.5"><Label>Saída *</Label><input type="time" value={fEnd} onChange={e => setFEnd(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Dias da semana</Label>
              <div className="flex gap-1.5">
                {WEEKDAYS.map((d, i) => (
                  <button key={i} type="button" onClick={() => toggleDay(i)}
                    className={`w-8 h-8 rounded-full text-xs font-semibold border transition-colors ${fDays.includes(i) ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'}`}>
                    {d[0]}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setFColor(c)}
                    className={`h-6 w-6 rounded-full transition-transform ${fColor === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110'}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <Button onClick={saveShift} disabled={saving} className="flex-1">{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar</Button>
              <Button variant="outline" onClick={() => setShiftOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal atribuir escala */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Atribuir escala</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5"><Label>Colaborador *</Label>
              <select value={aEmp} onChange={e => setAEmp(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="">Selecionar...</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label>Turno *</Label>
              <select value={aShift} onChange={e => setAShift(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                <option value="">Selecionar...</option>
                {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.start_time}–{s.end_time})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>A partir de *</Label><input type="date" value={aStart} onChange={e => setAStart(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
              <div className="space-y-1.5"><Label>Até (opcional)</Label><input type="date" value={aEnd} onChange={e => setAEnd(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-3 pt-1">
              <Button onClick={saveAssignment} disabled={saving} className="flex-1">{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Atribuir</Button>
              <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
