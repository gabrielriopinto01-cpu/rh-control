import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: me } = await admin.from('profiles').select('role, company_id').eq('id', user.id).single()
    if (!me || !['adm_total', 'rh'].includes(me.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Verifica que o colaborador pertence à empresa
    const { data: emp } = await admin.from('employees').select('*').eq('id', id).eq('company_id', me.company_id).single()
    if (!emp) return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 })

    // Coleta todos os dados
    const [docs, vacs, payItems, atts, reviews, certifs, leaves, trainComps, equips] = await Promise.all([
      admin.from('documents').select('*').eq('employee_id', id),
      admin.from('vacations').select('*').eq('employee_id', id),
      admin.from('payroll_items').select('*, payrolls(reference_month, status)').eq('employee_id', id),
      admin.from('attendance_records').select('*').eq('employee_id', id).order('date', { ascending: false }).limit(365),
      admin.from('performance_reviews').select('*').eq('employee_id', id),
      admin.from('medical_certificates').select('*').eq('employee_id', id),
      admin.from('leaves').select('*').eq('employee_id', id),
      admin.from('training_completions').select('*, trainings(title)').eq('employee_id', id),
      admin.from('equipment').select('*').eq('employee_id', id),
    ])

    const payload = {
      exportedAt: new Date().toISOString(),
      exportedBy: user.email,
      legalBasis: 'LGPD Art. 18 — Direito de portabilidade dos dados',
      employee: {
        ...emp,
        cpf: '***.***.***-**', // mascarado por segurança
      },
      documents:         docs.data ?? [],
      vacations:         vacs.data ?? [],
      payrollHistory:    payItems.data ?? [],
      attendanceLast365: atts.data ?? [],
      performanceReviews: reviews.data ?? [],
      medicalCertificates: certifs.data ?? [],
      leaves:            leaves.data ?? [],
      trainingsCompleted: trainComps.data ?? [],
      equipment:         equips.data ?? [],
    }

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="lgpd_${emp.full_name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.json"`,
      },
    })
  } catch (err) {
    console.error('lgpd-export error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
