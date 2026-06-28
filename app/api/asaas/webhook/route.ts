import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Eventos do Asaas: PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE, etc.
export async function POST(req: NextRequest) {
  try {
    // Validação opcional do token configurado no painel do Asaas
    const expected = process.env.ASAAS_WEBHOOK_TOKEN
    if (expected) {
      const token = req.headers.get('asaas-access-token')
      if (token !== expected) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const body = await req.json()
    const event   = body?.event as string | undefined
    const payment = body?.payment
    const companyId = payment?.externalReference as string | undefined
    if (!event || !companyId) return NextResponse.json({ received: true })

    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      // Pagamento ok → ativa por ~31 dias
      const expires = new Date(Date.now() + 31 * 86400000).toISOString()
      await admin.from('companies').update({
        plan_status: 'active', status: 'active', plan_expires_at: expires,
      }).eq('id', companyId)
    } else if (event === 'PAYMENT_OVERDUE') {
      await admin.from('companies').update({ plan_status: 'past_due' }).eq('id', companyId)
    } else if (event === 'PAYMENT_DELETED' || event === 'SUBSCRIPTION_DELETED') {
      await admin.from('companies').update({ plan_status: 'canceled' }).eq('id', companyId)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('asaas webhook error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
