/**
 * GET /api/automations/cron
 * Verifica aniversários do dia e documentos vencendo em 30 dias.
 * Pode ser chamado por um cron externo (Vercel Cron, cron-job.org) ou manualmente.
 * Protegido pelo header x-internal-secret.
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

  const today     = new Date()
  const mm        = String(today.getMonth() + 1).padStart(2, '0')
  const dd        = String(today.getDate()).padStart(2, '0')
  const todayMmDd = `${mm}-${dd}`

  // Busca todas as empresas ativas
  const { data: companies } = await admin
    .from('companies')
    .select('id')
    .eq('status', 'active')

  let birthdaysFired = 0
  let docsFired      = 0

  for (const company of (companies ?? [])) {
    // ── Aniversários ───────────────────────────────────────────────
    const { data: emps } = await admin
      .from('employees')
      .select('id, full_name, birth_date')
      .eq('company_id', company.id)
      .eq('status', 'active')
      .not('birth_date', 'is', null)

    for (const emp of (emps ?? [])) {
      if (!emp.birth_date) continue
      const empMmDd = emp.birth_date.slice(5, 10) // 'YYYY-MM-DD' → 'MM-DD'
      if (empMmDd === todayMmDd) {
        triggerAutomation(company.id, 'birthday', { nome: emp.full_name }, { employee_id: emp.id })
        birthdaysFired++
      }
    }

    // ── Documentos vencendo em ≤30 dias ────────────────────────────
    const in30 = new Date(today)
    in30.setDate(in30.getDate() + 30)
    const in30Str = in30.toISOString().slice(0, 10)
    const todayStr = today.toISOString().slice(0, 10)

    const { data: docs } = await admin
      .from('documents')
      .select('id, employee_id, name, expiry_date, employees(full_name)')
      .eq('company_id', company.id)
      .not('expiry_date', 'is', null)
      .gte('expiry_date', todayStr)
      .lte('expiry_date', in30Str)

    for (const doc of (docs ?? [])) {
      const expiry    = new Date(doc.expiry_date)
      const daysLeft  = Math.ceil((expiry.getTime() - today.getTime()) / 86400000)
      const empName   = (doc.employees as any)?.full_name ?? ''
      triggerAutomation(company.id, 'document_expiring', {
        nome:       empName,
        documento:  doc.name,
        dias:       String(daysLeft),
        data:       new Date(doc.expiry_date).toLocaleDateString('pt-BR'),
      }, { employee_id: doc.employee_id })
      docsFired++
    }
  }

  return NextResponse.json({ ok: true, birthdaysFired, docsFired, companies: (companies ?? []).length })
}
