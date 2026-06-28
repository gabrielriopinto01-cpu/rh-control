import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getResend, FROM_EMAIL } from '@/lib/resend/client'
import { signatureRequestEmail } from '@/lib/resend/templates'

export const dynamic = 'force-dynamic'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { signatureId } = await req.json()
    if (!signatureId) return NextResponse.json({ error: 'signatureId obrigatório' }, { status: 400 })

    // Busca assinatura com dados do colaborador e empresa
    const { data: sig, error } = await admin
      .from('document_signatures')
      .select(`
        id, token, document_name, expires_at,
        employee:employees(full_name, email),
        company:companies(name)
      `)
      .eq('id', signatureId)
      .single()

    if (error || !sig) return NextResponse.json({ error: 'Assinatura não encontrada' }, { status: 404 })

    const employee = (sig.employee as any)
    const company  = (sig.company  as any)

    if (!employee?.email) {
      return NextResponse.json({ error: 'Colaborador não tem e-mail cadastrado' }, { status: 400 })
    }

    const signUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://rhcontrol.tec.br'}/sign/${sig.token}`

    const resend = getResend()
    const { error: sendError } = await resend.emails.send({
      from:    FROM_EMAIL,
      to:      [employee.email],
      subject: `✍️ ${sig.document_name} — aguarda sua assinatura`,
      html:    signatureRequestEmail({
        employeeName: employee.full_name,
        companyName:  company?.name ?? 'Sua empresa',
        documentName: sig.document_name,
        signUrl,
        expiresAt:    sig.expires_at,
      }),
    })

    if (sendError) {
      console.error('Resend error:', sendError)
      return NextResponse.json({ error: 'Falha ao enviar e-mail', detail: sendError }, { status: 500 })
    }

    // Registra na trilha de auditoria
    await admin.from('signature_audit_trail').insert({
      signature_id: sig.id,
      event: 'email_sent',
      description: `E-mail de solicitação enviado para ${employee.email}`,
    })

    return NextResponse.json({ ok: true, sentTo: employee.email })
  } catch (err) {
    console.error('signature email error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
