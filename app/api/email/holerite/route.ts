import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getResend, FROM_EMAIL } from '@/lib/resend/client'
import { holeritEmail } from '@/lib/resend/templates'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { payrollItemId } = body

    if (!payrollItemId) {
      return NextResponse.json({ error: 'payrollItemId obrigatório' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )

    // Busca o item da folha com dados do colaborador e empresa
    const { data: item, error } = await supabase
      .from('payroll_items')
      .select(`
        *,
        employee:employees(full_name, email),
        payroll_run:payroll_runs(ref_month, company:companies(name))
      `)
      .eq('id', payrollItemId)
      .single()

    if (error || !item) {
      return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })
    }

    const emp      = item.employee as any
    const run      = item.payroll_run as any
    const company  = run?.company as any

    if (!emp?.email) {
      return NextResponse.json({ error: 'Colaborador sem e-mail cadastrado' }, { status: 400 })
    }

    const html = holeritEmail({
      employeeName: emp.full_name,
      companyName:  company?.name ?? 'Empresa',
      refMonth:     run?.ref_month ?? '',
      baseSalary:   item.base_salary ?? 0,
      inss:         item.inss_deduction ?? 0,
      irrf:         item.irrf_deduction ?? 0,
      fgts:         item.fgts ?? 0,
      netSalary:    item.net_salary ?? 0,
      extras:       item.other_additions ?? [],
      discounts:    item.other_discounts ?? [],
    })

    const { data: sent, error: sendError } = await getResend().emails.send({
      from:    FROM_EMAIL,
      to:      emp.email,
      subject: `Holerite ${run?.ref_month} — ${company?.name ?? 'RH Control'}`,
      html,
    })

    if (sendError) {
      console.error('Resend error:', sendError)
      return NextResponse.json({ error: 'Falha ao enviar e-mail' }, { status: 500 })
    }

    return NextResponse.json({ success: true, emailId: sent?.id })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
