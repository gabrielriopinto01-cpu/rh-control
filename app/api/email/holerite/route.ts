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
        payroll:payrolls(reference_month, company_id, company:companies(name))
      `)
      .eq('id', payrollItemId)
      .single()

    if (error || !item) {
      return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })
    }

    const emp     = item.employee as any
    const payroll = item.payroll  as any
    const company = payroll?.company as any

    if (!emp?.email) {
      return NextResponse.json({ error: 'Colaborador sem e-mail cadastrado' }, { status: 400 })
    }

    const extras    = (item.other_additions ?? []) as { descricao: string; valor: number }[]
    const discounts = (item.other_discounts  ?? []) as { descricao: string; valor: number }[]

    const html = holeritEmail({
      employeeName: emp.full_name,
      companyName:  company?.name ?? 'Empresa',
      refMonth:     payroll?.reference_month ?? '',
      baseSalary:   item.gross_salary ?? 0,
      inss:         item.inss ?? 0,
      irrf:         item.irrf ?? 0,
      fgts:         item.fgts ?? 0,
      netSalary:    item.net_salary ?? 0,
      extras,
      discounts,
    })

    const { data: sent, error: sendError } = await getResend().emails.send({
      from:    FROM_EMAIL,
      to:      emp.email,
      subject: `Holerite ${payroll?.reference_month} — ${company?.name ?? 'RH Control'}`,
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
