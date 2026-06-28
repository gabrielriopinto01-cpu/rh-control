'use client'

import { useEffect, useState, useCallback } from 'react'
import { Clock, MapPin, CheckCircle2, ChevronLeft, ChevronRight, AlertCircle, UserX, UserCheck, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useMyEmployee } from '@/hooks/use-my-employee'
import { formatDate } from '@/lib/utils'
import { reverseGeocode } from '@/lib/geo'
import { SelfieCapture } from '@/components/modules/attendance/selfie-capture'
import type { AttendanceRecord, AttendanceStatus, AttendanceConfig, PunchKind } from '@/types/database'

export const dynamic = 'force-dynamic'

const STATUS_MAP: Record<AttendanceStatus, { label: string; color: string }> = {
  present:  { label: 'Presente',     color: 'bg-green-100 text-green-700' },
  absent:   { label: 'Faltou',       color: 'bg-red-100 text-red-700' },
  late:     { label: 'Atrasado',     color: 'bg-yellow-100 text-yellow-700' },
  half_day: { label: 'Meio período', color: 'bg-blue-100 text-blue-700' },
  holiday:  { label: 'Feriado',      color: 'bg-purple-100 text-purple-700' },
  vacation: { label: 'Férias',       color: 'bg-indigo-100 text-indigo-700' },
}

function calcHours(clockIn: string, clockOut: string, lunchStart: string, lunchEnd: string): number | null {
  if (!clockIn || !clockOut) return null
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  let worked = toMin(clockOut) - toMin(clockIn)
  if (lunchStart && lunchEnd) worked -= (toMin(lunchEnd) - toMin(lunchStart))
  if (worked < 0) return null
  return +(worked / 60).toFixed(2)
}

function formatHours(h: number | null) {
  if (h === null) return '—'
  const hrs = Math.floor(h)
  const min = Math.round((h - hrs) * 60)
  return `${hrs}h${min > 0 ? `${String(min).padStart(2, '0')}m` : ''}`
}

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month, 1)
  const end   = new Date(year, month + 1, 0)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

type ClockStep = 'in' | 'lunch_start' | 'lunch_end' | 'out' | 'done'

export default function MeuPontoPage() {
  const { user }                    = useAuth()
  const { employee, loading: empLoading } = useMyEmployee()
  const today = new Date()

  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading,  setLoading]  = useState(true)
  const [clocking, setClocking] = useState(false)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locLabel, setLocLabel] = useState<string>('')
  const [config,   setConfig]   = useState<AttendanceConfig>({})
  const [selfieOpen, setSelfieOpen] = useState(false)

  const todayStr = today.toISOString().slice(0, 10)
  const todayRec = records.find(r => r.date === todayStr)

  // Determina próximo passo do ponto
  function nextStep(): ClockStep {
    if (!todayRec || !todayRec.clock_in)    return 'in'
    if (!todayRec.lunch_start)               return 'lunch_start'
    if (!todayRec.lunch_end)                 return 'lunch_end'
    if (!todayRec.clock_out)                 return 'out'
    return 'done'
  }

  const step = nextStep()

  const STEP_LABELS: Record<ClockStep, string> = {
    in:          'Registrar Entrada',
    lunch_start: 'Iniciar Almoço',
    lunch_end:   'Retornar do Almoço',
    out:         'Registrar Saída',
    done:        'Ponto Encerrado',
  }

  const STEP_COLORS: Record<ClockStep, string> = {
    in:          'bg-green-500 hover:bg-green-600',
    lunch_start: 'bg-yellow-500 hover:bg-yellow-600',
    lunch_end:   'bg-blue-500 hover:bg-blue-600',
    out:         'bg-red-500 hover:bg-red-600',
    done:        'bg-gray-400 cursor-not-allowed',
  }

  // Busca geolocalização
  const getLocation = (): Promise<{ lat: number; lng: number } | null> =>
    new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        ()  => resolve(null),
        { timeout: 8000 }
      )
    })

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !user || !employee) { setLoading(false); return }
    const supabase = createClient()
    const { start, end } = getMonthRange(year, month)
    const { data } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('company_id', user.company_id)
      .eq('employee_id', employee.id)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })
    setRecords(data ?? [])
    setLoading(false)
  }, [user, employee, year, month])

  useEffect(() => { load() }, [load])

  // Captura localização ao montar
  useEffect(() => {
    getLocation().then(loc => {
      if (loc) {
        setLocation(loc)
        setLocLabel(`${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`)
      }
    })
  }, [])

  // Carrega a config de ponto da empresa (cerca virtual, selfie)
  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    const supabase = createClient()
    supabase.from('companies').select('attendance_config').eq('id', user.company_id).single()
      .then(({ data }) => setConfig((data?.attendance_config ?? {}) as AttendanceConfig))
  }, [user])

  // Clique no botão: se selfie obrigatória, abre a câmera; senão bate direto
  const handleClock = () => {
    if (!user || !employee || step === 'done' || clocking) return
    if (config.require_selfie) { setSelfieOpen(true); return }
    doPunch()
  }

  // Selfie capturada → faz upload e bate o ponto
  const handleSelfie = async (blob: Blob) => {
    if (!user || !employee) return
    setSelfieOpen(false)
    setClocking(true)
    const supabase = createClient()
    const path = `${user.company_id}/${employee.id}/${Date.now()}.jpg`
    const { error } = await supabase.storage.from('attendance').upload(path, blob, { contentType: 'image/jpeg', upsert: true })
    if (error) { toast.error('Erro ao enviar a selfie'); setClocking(false); return }
    const { data } = supabase.storage.from('attendance').getPublicUrl(path)
    await doPunch(data.publicUrl)
  }

  // Registra a batida via API (captura GPS, endereço; servidor grava IP/dispositivo/cerca)
  const doPunch = async (selfieUrl?: string) => {
    if (step === 'done') return
    setClocking(true)
    try {
      const loc = location ?? await getLocation()
      const address = loc ? await reverseGeocode(loc.lat, loc.lng) : null
      const res = await fetch('/api/attendance/punch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: step as PunchKind,
          latitude:  loc?.lat ?? null,
          longitude: loc?.lng ?? null,
          address, selfieUrl: selfieUrl ?? null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Erro ao registrar ponto'); return }

      const labels: Record<PunchKind, string> = {
        in: 'Entrada', lunch_start: 'Início do almoço', lunch_end: 'Retorno do almoço', out: 'Saída',
      }
      toast.success(`${labels[step as PunchKind]} registrada às ${json.time}`)
      if (json.within_fence === false) {
        toast.warning('Atenção: você está fora da área permitida (cerca virtual).', { duration: 6000 })
      }
      load()
    } catch {
      toast.error('Erro ao registrar ponto')
    } finally {
      setClocking(false)
    }
  }

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  const monthLabel = new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const stats = {
    present:    records.filter(r => r.status === 'present').length,
    absent:     records.filter(r => r.status === 'absent').length,
    late:       records.filter(r => r.status === 'late').length,
    totalHours: records.reduce((s, r) => s + (r.total_hours ?? 0), 0),
    overtime:   records.reduce((s, r) => s + (r.overtime   ?? 0), 0),
  }

  function exportCSV() {
    const header = 'Data,Entrada,Saída,Almoço Início,Almoço Fim,Horas,Extras,Status'
    const rows = records.map(r => {
      const hrs = r.total_hours ?? calcHours(r.clock_in ?? '', r.clock_out ?? '', r.lunch_start ?? '', r.lunch_end ?? '')
      const ot  = r.overtime ?? (hrs !== null && hrs > 8 ? +(hrs - 8).toFixed(2) : null)
      return [
        r.date, r.clock_in ?? '', r.clock_out ?? '',
        r.lunch_start ?? '', r.lunch_end ?? '',
        hrs !== null ? hrs.toString().replace('.', ',') : '',
        ot  !== null ? ot.toString().replace('.', ',')  : '',
        STATUS_MAP[r.status]?.label ?? r.status,
      ].join(',')
    })
    const csv  = [header, ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `meu_ponto_${monthLabel.replace(/\s/g, '_')}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (empLoading) return <div className="p-8 text-center text-gray-400">Carregando...</div>

  if (!employee) return (
    <div className="p-12 text-center">
      <AlertCircle className="h-10 w-10 text-yellow-400 mx-auto mb-3" />
      <p className="font-semibold text-gray-700">Seu usuário não está vinculado a um funcionário</p>
      <p className="text-sm text-gray-400 mt-1">Peça ao RH para vincular seu perfil ao cadastro de colaborador.</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meu Ponto</h1>
          <p className="text-gray-500 mt-1">{employee.full_name}</p>
        </div>
        {records.length > 0 && (
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        )}
      </div>

      {/* Card principal — bater ponto */}
      <div className="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col items-center gap-6 shadow-sm">
        {/* Relógio */}
        <div className="text-center">
          <LiveClock />
          <p className="text-gray-400 text-sm mt-1 capitalize">
            {today.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Geolocalização */}
        {locLabel && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <MapPin className="h-3.5 w-3.5 text-green-500" />
            <span>Localização: {locLabel}</span>
          </div>
        )}

        {/* Linha do dia */}
        {todayRec && (
          <div className="grid grid-cols-4 gap-3 w-full max-w-sm text-center text-sm">
            {[
              { label: 'Entrada',       value: todayRec.clock_in    },
              { label: 'Iní. Almoço',   value: todayRec.lunch_start },
              { label: 'Ret. Almoço',   value: todayRec.lunch_end   },
              { label: 'Saída',         value: todayRec.clock_out   },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className={`font-bold text-base ${value ? 'text-gray-800' : 'text-gray-300'}`}>{value ?? '—:——'}</p>
              </div>
            ))}
          </div>
        )}

        {/* Botão bater ponto */}
        <button
          onClick={handleClock}
          disabled={step === 'done' || clocking}
          className={`w-48 h-48 rounded-full text-white font-bold text-lg shadow-lg transition-all active:scale-95 flex flex-col items-center justify-center gap-2 ${STEP_COLORS[step]}`}
        >
          {clocking ? (
            <span className="animate-spin text-3xl">⟳</span>
          ) : step === 'done' ? (
            <>
              <CheckCircle2 className="h-10 w-10" />
              <span>Encerrado</span>
            </>
          ) : (
            <>
              <Clock className="h-10 w-10" />
              <span className="text-center px-3">{STEP_LABELS[step]}</span>
            </>
          )}
        </button>

        {/* Status do dia */}
        {todayRec && (
          <Badge variant="outline" className={STATUS_MAP[todayRec.status].color + ' border-0 px-3 py-1'}>
            {STATUS_MAP[todayRec.status].label}
          </Badge>
        )}
      </div>

      <SelfieCapture open={selfieOpen} onClose={() => setSelfieOpen(false)} onCapture={handleSelfie} />

      {/* Stats do mês */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Presenças',    value: stats.present,              Icon: UserCheck,   color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Faltas',       value: stats.absent,               Icon: UserX,       color: 'text-red-600',    bg: 'bg-red-50' },
          { label: 'Atrasos',      value: stats.late,                 Icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Total horas',  value: formatHours(stats.totalHours), Icon: Clock,    color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Horas extras', value: formatHours(stats.overtime),   Icon: Clock,    color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(({ label, value, Icon, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4 flex items-center gap-3`}>
            <Icon className={`h-5 w-5 ${color} shrink-0`} />
            <div>
              <p className="text-lg font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Navegação mês + histórico */}
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-gray-100"><ChevronLeft className="h-5 w-5" /></button>
        <span className="font-semibold text-gray-800 capitalize w-52 text-center">{monthLabel}</span>
        <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-gray-100"><ChevronRight className="h-5 w-5" /></button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : records.length === 0 ? (
          <div className="p-10 text-center">
            <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Nenhum registro neste mês</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Data','Entrada','Saída','Horas','Extras','Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map(rec => {
                const hrs = rec.total_hours ?? calcHours(rec.clock_in ?? '', rec.clock_out ?? '', rec.lunch_start ?? '', rec.lunch_end ?? '')
                const ot  = rec.overtime ?? (hrs !== null && hrs > 8 ? +(hrs - 8).toFixed(2) : null)
                const s   = STATUS_MAP[rec.status]
                return (
                  <tr key={rec.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{formatDate(rec.date)}</td>
                    <td className="px-4 py-3 text-gray-600">{rec.clock_in   ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{rec.clock_out  ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-blue-700">{formatHours(hrs)}</td>
                    <td className="px-4 py-3 text-purple-600 text-xs">{ot && ot > 0 ? `+${formatHours(ot)}` : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function LiveClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return <p className="text-5xl font-bold text-gray-900 tabular-nums">{time}</p>
}
