import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { resend, FROM_EMAIL } from '@/lib/resend/client'
import { vacationApprovedEmail } from '@/lib/resend/templates'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { vacationId } = await req.json()
    if (!vacationId) return NextResponse.json({ error: 'vacationId obrigatório' }, { status: 400 })

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )

    const { data: vac, error } = await supabase
      .from('vacations')
      .select(`
        *,
        employee:employees(full_name, email),
        company:companies(name)
      `)
      .eq('id', vacationId)
      .single()

    if (error || !vac) return NextResponse.json({ error: 'Férias não encontradas' }, { status: 404 })

    const emp     = vac.employee as any
    const company = vac.company  as any

    if (!emp?.email) return NextResponse.json({ error: 'Colaborador sem e-mail' }, { status: 400 })

    const start = new Date(vac.start_date + 'T12:00:00')
    const end   = new Date(vac.end_date   + 'T12:00:00')
    const days  = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1

    const { data: approver } = await supabase.auth.getUser()

    const html = vacationApprovedEmail({
      employeeName: emp.full_name,
      companyName:  company?.name ?? 'Empresa',
      startDate:    vac.start_date,
      endDate:      vac.end_date,
      days,
      approvedBy:   approver.user?.email ?? 'RH',
    })

    const { error: sendError } = await resend.emails.send({
      from:    FROM_EMAIL,
      to:      emp.email,
      subject: `🌴 Suas férias foram aprovadas — ${company?.name ?? 'RH Control'}`,
      html,
    })

    if (sendError) return NextResponse.json({ error: 'Falha ao enviar e-mail' }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
