import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { isWithinFence } from '@/lib/geo'
import type { PunchKind } from '@/types/database'

export const dynamic = 'force-dynamic'

const STEP_FIELD: Record<PunchKind, string> = {
  in: 'clock_in', lunch_start: 'lunch_start', lunch_end: 'lunch_end', out: 'clock_out',
}

function calcHours(clockIn: string, clockOut: string, lunchStart: string, lunchEnd: string): number | null {
  if (!clockIn || !clockOut) return null
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  let worked = toMin(clockOut) - toMin(clockIn)
  if (lunchStart && lunchEnd) worked -= (toMin(lunchEnd) - toMin(lunchStart))
  if (worked < 0) return null
  return +(worked / 60).toFixed(2)
}

export async function POST(req: NextRequest) {
  try {
    const { kind, latitude, longitude, address, selfieUrl } = await req.json() as {
      kind: PunchKind; latitude?: number; longitude?: number; address?: string; selfieUrl?: string
    }
    if (!kind || !STEP_FIELD[kind]) {
      return NextResponse.json({ error: 'Tipo de batida inválido' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('company_id, employee_id').eq('id', user.id).single()
    if (!profile?.employee_id) {
      return NextResponse.json({ error: 'Seu usuário não está vinculado a um colaborador' }, { status: 400 })
    }
    const companyId = profile.company_id
    const employeeId = profile.employee_id

    // Metadados do request
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip') ?? 'desconhecido'
    const device = req.headers.get('user-agent') ?? 'desconhecido'

    // Cerca virtual
    const { data: company } = await supabase
      .from('companies').select('attendance_config').eq('id', companyId).single()
    const cfg = (company?.attendance_config ?? {}) as {
      geofence_enabled?: boolean; lat?: number; lng?: number; radius_m?: number; require_selfie?: boolean
    }
    let withinFence: boolean | null = null
    if (cfg.geofence_enabled && cfg.lat != null && cfg.lng != null && cfg.radius_m) {
      if (latitude != null && longitude != null) {
        withinFence = isWithinFence(latitude, longitude, { lat: cfg.lat, lng: cfg.lng, radius_m: cfg.radius_m })
      } else {
        withinFence = false
      }
    }
    if (cfg.require_selfie && !selfieUrl) {
      return NextResponse.json({ error: 'Selfie obrigatória para registrar o ponto.' }, { status: 400 })
    }

    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    // Carrega/atualiza o registro do dia
    const { data: existing } = await supabase
      .from('attendance_records').select('*')
      .eq('company_id', companyId).eq('employee_id', employeeId).eq('date', todayStr)
      .maybeSingle()

    let recordId = existing?.id ?? null

    if (kind === 'in') {
      if (existing?.clock_in) {
        return NextResponse.json({ error: 'Entrada já registrada hoje' }, { status: 409 })
      }
      const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 5)
      const { data: ins, error } = await supabase.from('attendance_records').insert({
        company_id: companyId, employee_id: employeeId, date: todayStr,
        clock_in: timeStr, status: isLate ? 'late' : 'present',
      }).select('id').single()
      if (error || !ins) return NextResponse.json({ error: 'Erro ao registrar entrada' }, { status: 500 })
      recordId = ins.id
    } else {
      if (!existing) return NextResponse.json({ error: 'Registre a entrada primeiro' }, { status: 400 })
      const update: Record<string, string | number | null> = { [STEP_FIELD[kind]]: timeStr }
      if (kind === 'out') {
        const total = calcHours(existing.clock_in ?? '', timeStr, existing.lunch_start ?? '', existing.lunch_end ?? '')
        update.total_hours = total
        update.overtime = total !== null && total > 8 ? +(total - 8).toFixed(2) : null
      }
      const { error } = await supabase.from('attendance_records').update(update).eq('id', existing.id)
      if (error) return NextResponse.json({ error: 'Erro ao registrar batida' }, { status: 500 })
    }

    // Registra a batida com metadados
    await supabase.from('attendance_punches').insert({
      company_id: companyId, employee_id: employeeId, record_id: recordId,
      kind, punched_at: now.toISOString(),
      latitude: latitude ?? null, longitude: longitude ?? null,
      address: address ?? null, selfie_url: selfieUrl ?? null,
      ip, device, within_fence: withinFence,
    })

    return NextResponse.json({ success: true, time: timeStr, kind, within_fence: withinFence })
  } catch (err) {
    console.error('punch error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
