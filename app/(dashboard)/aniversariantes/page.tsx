'use client'

import { useEffect, useState, useCallback } from 'react'
import { Gift, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type Birthday = {
  id: string
  full_name: string
  position: string | null
  department: { name: string } | null
  birth_date: string
  hire_date: string | null
}

const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

const DEPT_COLORS = [
  'bg-blue-100 text-blue-700','bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700','bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700','bg-teal-100 text-teal-700',
  'bg-amber-100 text-amber-700','bg-indigo-100 text-indigo-700',
]

function hashDept(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return Math.abs(h) % DEPT_COLORS.length
}

function age(birthDate: string, year: number) {
  const birth = new Date(birthDate)
  return year - birth.getFullYear()
}

function isToday(day: number, month: number) {
  const now = new Date()
  return now.getDate() === day && now.getMonth() === month
}

export default function AniversariantesPage() {
  const { user } = useAuth()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year,  setYear]  = useState(now.getFullYear())
  const [employees, setEmployees] = useState<Birthday[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user?.company_id) { setLoading(false); return }
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('employees')
      .select('id, full_name, position, hire_date, birth_date, department:departments(name)')
      .eq('company_id', user.company_id)
      .eq('status', 'active')
      .not('birth_date', 'is', null)
      .order('full_name')
    setEmployees((data ?? []) as unknown as Birthday[])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  function changeMonth(delta: number) {
    let m = month + delta; let y = year
    if (m < 0)  { m = 11; y-- }
    if (m > 11) { m = 0;  y++ }
    setMonth(m); setYear(y)
  }

  const monthStr = String(month + 1).padStart(2, '0')
  const filtered = employees.filter(e => {
    const bMonth = e.birth_date.slice(5, 7)
    if (bMonth !== monthStr) return false
    if (search) return e.full_name.toLowerCase().includes(search.toLowerCase())
    return true
  })

  // Agrupar por semana do mês
  const weeks: Map<number, Birthday[]> = new Map()
  for (const e of filtered) {
    const day  = parseInt(e.birth_date.slice(8, 10))
    const week = Math.ceil(day / 7)
    if (!weeks.has(week)) weeks.set(week, [])
    weeks.get(week)!.push(e)
  }
  const weekEntries = Array.from(weeks.entries()).sort((a,b) => a[0]-b[0])

  // Todos os aniversários do ano agrupados por mês (para o mini-calendário)
  const allByMonth: Record<number, number> = {}
  for (const e of employees) {
    const m = parseInt(e.birth_date.slice(5, 7)) - 1
    allByMonth[m] = (allByMonth[m] ?? 0) + 1
  }

  const todayBirths = filtered.filter(e => isToday(parseInt(e.birth_date.slice(8, 10)), month))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gift className="h-6 w-6 text-pink-500" /> Aniversariantes
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Celebre os colaboradores do seu time</p>
      </div>

      {/* Cabeçalho de navegação */}
      <div className="bg-white border rounded-xl p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={() => changeMonth(-1)} className="p-2 rounded-lg border hover:bg-gray-50">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center min-w-32">
              <p className="text-lg font-bold text-gray-900">{MONTH_NAMES[month]}</p>
              <p className="text-sm text-gray-500">{year}</p>
            </div>
            <button onClick={() => changeMonth(1)} className="p-2 rounded-lg border hover:bg-gray-50">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {filtered.length > 0 && (
              <span className="text-sm text-gray-500">
                <span className="font-semibold text-gray-900">{filtered.length}</span> aniversariante{filtered.length !== 1 ? 's' : ''}
              </span>
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="Filtrar nome..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 w-40 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Mini-calendário anual */}
        <div className="mt-5 grid grid-cols-6 sm:grid-cols-12 gap-1.5">
          {MONTH_NAMES.map((name, i) => (
            <button
              key={i}
              onClick={() => { setMonth(i); setYear(now.getFullYear()) }}
              className={`rounded-lg p-1.5 text-center transition-colors text-xs ${
                i === month && year === now.getFullYear()
                  ? 'bg-pink-500 text-white'
                  : i === now.getMonth() && year === now.getFullYear()
                    ? 'border-2 border-pink-300 text-pink-700 hover:bg-pink-50'
                    : 'hover:bg-gray-50 text-gray-600'
              }`}
            >
              <p className="font-medium">{name.slice(0, 3)}</p>
              {allByMonth[i] ? (
                <p className={`mt-0.5 ${i === month && year === now.getFullYear() ? 'text-pink-100' : 'text-pink-500'}`}>
                  {allByMonth[i]}
                </p>
              ) : <p className="mt-0.5 text-transparent">0</p>}
            </button>
          ))}
        </div>
      </div>

      {/* Parabéns de hoje */}
      {todayBirths.length > 0 && (
        <div className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🎂</span>
            <h2 className="font-bold text-lg">Parabéns hoje!</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {todayBirths.map(b => (
              <Link key={b.id} href={`/employees/${b.id}`}
                className="bg-white/20 hover:bg-white/30 transition-colors rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="font-semibold">{b.full_name}</span>
                <span className="text-pink-100 text-sm">completa {age(b.birth_date, year)} anos 🎉</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-400">
          <Gift className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhum aniversário em {MONTH_NAMES[month]}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {weekEntries.map(([week, emps]) => (
            <div key={week}>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Semana {week} — dias {(week-1)*7+1}–{Math.min(week*7, 31)}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {emps.sort((a,b) => a.birth_date.localeCompare(b.birth_date)).map(e => {
                  const day     = parseInt(e.birth_date.slice(8, 10))
                  const isB     = isToday(day, month)
                  const deptName = (e.department as { name: string } | null)?.name ?? 'Sem departamento'
                  const colorIdx = hashDept(deptName)
                  const yrsOld  = age(e.birth_date, year)
                  const tenureYrs = e.hire_date ? year - new Date(e.hire_date).getFullYear() : null

                  return (
                    <Link key={e.id} href={`/employees/${e.id}`}
                      className={`bg-white border rounded-xl p-4 hover:shadow-md transition-all flex items-center gap-4 ${isB ? 'border-pink-300 bg-pink-50' : ''}`}
                    >
                      {/* Dia */}
                      <div className={`shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold ${isB ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-700'}`}>
                        <span className="text-lg leading-none">{day}</span>
                        <span className="text-[10px] leading-none mt-0.5 font-normal opacity-70">{MONTH_NAMES[month].slice(0,3)}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{e.full_name}</p>
                        <p className="text-xs text-gray-400 truncate">{e.position ?? 'Sem cargo'}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${DEPT_COLORS[colorIdx]}`}>
                            {deptName}
                          </span>
                          <span className="text-[10px] text-gray-400">{yrsOld} anos</span>
                          {tenureYrs !== null && tenureYrs > 0 && (
                            <span className="text-[10px] text-blue-500">{tenureYrs}a empresa</span>
                          )}
                        </div>
                      </div>

                      {isB && <span className="text-xl shrink-0">🎂</span>}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
