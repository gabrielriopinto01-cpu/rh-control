/**
 * GET /api/automations/cron
 * Roda diariamente (Vercel Cron às 08:00 BRT) e dispara automações de RH:
 *  - Aniversários de nascimento
 *  - Aniversários de empresa (tempo de serviço)
 *  - Documentos vencendo em ≤30 dias
 *  - Férias iniciando amanhã
 *  - Ponto não registrado no dia anterior (colaboradores ativos)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { triggerAutomation } from '@/lib/automations'

export const dynamic = 'force-dynamic'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret')
  if (secret !== process.env.INTERNAL_API_SECRET && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const today    = new Date()
  const mm       = String(today.getMonth() + 1).padStart(2, '0')
  const dd       = String(today.getDate()).padStart(2, '0')
  const todayMmDd = `${mm}-${dd}`
  const todayStr  = today.toISOString().slice(0, 10)

  // Dia anterior (para checar ponto)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  // Amanhã (para férias iniciando)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)

  // 30 dias à frente (documentos)
  const in30 = new Date(today)
  in30.setDate(in30.getDate() + 30)
  const in30Str = in30.toISOString().slice(0, 10)

  const { data: companies } = await admin
    .from('companies')
    .select('id')
    .eq('status', 'active')

  const stats = { birthdaysFired: 0, anniversariesFired: 0, docsFired: 0, vacationsFired: 0, missingPunchFired: 0 }

  for (const company of (companies ?? [])) {
    const companyId = company.id

    // ── 1. Aniversários de nascimento ──────────────────────────────
    const { data: emps } = await admin
      .from('employees')
      .select('id, full_name, birth_date, hire_date, phone')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .not('birth_date', 'is', null)

    for (const emp of (emps ?? [])) {
      if (!emp.birth_date) continue
      const empMmDd = emp.birth_date.slice(5, 10)
      if (empMmDd === todayMmDd) {
        triggerAutomation(companyId, 'birthday', { nome: emp.full_name }, { employee_id: emp.id })
        stats.birthdaysFired++
      }
    }

    // ── 2. Aniversários de empresa ─────────────────────────────────
    for (const emp of (emps ?? [])) {
      if (!emp.hire_date) continue
      const hireMmDd = emp.hire_date.slice(5, 10)
      if (hireMmDd !== todayMmDd) continue
      const years = today.getFullYear() - new Date(emp.hire_date).getFullYear()
      if (years < 1) continue
      triggerAutomation(companyId, 'work_anniversary', {
        nome: emp.full_name,
        anos: String(years),
      }, { employee_id: emp.id })
      stats.anniversariesFired++
    }

    // ── 3. Documentos vencendo em ≤30 dias ────────────────────────
    const { data: docs } = await admin
      .from('documents')
      .select('id, employee_id, name, expiry_date, employees(full_name)')
      .eq('company_id', companyId)
      .not('expiry_date', 'is', null)
      .gte('expiry_date', todayStr)
      .lte('expiry_date', in30Str)

    for (const doc of (docs ?? [])) {
      const daysLeft = Math.ceil((new Date(doc.expiry_date).getTime() - today.getTime()) / 86400000)
      triggerAutomation(companyId, 'document_expiring', {
        nome:      (doc.employees as any)?.full_name ?? '',
        documento: doc.name,
        dias:      String(daysLeft),
        data:      new Date(doc.expiry_date).toLocaleDateString('pt-BR'),
      }, { employee_id: doc.employee_id })
      stats.docsFired++
    }

    // ── 4. Férias iniciando amanhã ─────────────────────────────────
    const { data: vacs } = await admin
      .from('vacations')
      .select('id, employee_id, start_date, end_date, days, employees(full_name)')
      .eq('company_id', companyId)
      .eq('status', 'approved')
      .eq('start_date', tomorrowStr)

    for (const v of (vacs ?? [])) {
      triggerAutomation(companyId, 'vacation_starting', {
        nome:   (v.employees as any)?.full_name ?? '',
        inicio: new Date(v.start_date).toLocaleDateString('pt-BR'),
        fim:    new Date(v.end_date).toLocaleDateString('pt-BR'),
        dias:   String(v.days),
      }, { employee_id: v.employee_id })
      stats.vacationsFired++
    }

    // ── 5. Ponto não registrado ontem (segunda a sexta) ───────────
    const dayOfWeek = yesterday.getDay() // 0=Dom, 6=Sáb
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      const { data: activeEmps } = await admin
        .from('employees')
        .select('id, full_name')
        .eq('company_id', companyId)
        .eq('status', 'active')

      if (activeEmps && activeEmps.length > 0) {
        const empIds = activeEmps.map(e => e.id)
        const { data: records } = await admin
          .from('attendance_records')
          .select('employee_id')
          .eq('company_id', companyId)
          .eq('date', yesterdayStr)
          .in('employee_id', empIds)

        const presentIds = new Set((records ?? []).map(r => r.employee_id))
        for (const emp of activeEmps) {
          if (!presentIds.has(emp.id)) {
            triggerAutomation(companyId, 'missing_punch', {
              nome: emp.full_name,
              data: yesterday.toLocaleDateString('pt-BR'),
            }, { employee_id: emp.id })
            stats.missingPunchFired++
          }
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    companies: (companies ?? []).length,
    ...stats,
  })
}
