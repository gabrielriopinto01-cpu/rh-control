import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { isAsaasConfigured, ensureCustomer, createSubscription } from '@/lib/asaas'

export const dynamic = 'force-dynamic'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    if (!isAsaasConfigured()) {
      return NextResponse.json({ error: 'Pagamento não configurado. Adicione ASAAS_API_KEY no .env.local.' }, { status: 503 })
    }

    const { plan, cpfCnpj, billingType } = await req.json() as {
      plan?: string; cpfCnpj?: string; billingType?: 'PIX' | 'BOLETO' | 'CREDIT_CARD'
    }
    if (!plan || !cpfCnpj) return NextResponse.json({ error: 'Informe o plano e o CPF/CNPJ' }, { status: 400 })

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: me } = await admin.from('profiles').select('role, company_id, full_name, email').eq('id', user.id).single()
    if (!me || !['adm_total', 'rh'].includes(me.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { data: company } = await admin.from('companies').select('name, asaas_customer_id').eq('id', me.company_id).single()

    const customerId = await ensureCustomer({
      existingId: company?.asaas_customer_id,
      name: company?.name ?? me.full_name,
      email: me.email,
      cpfCnpj,
    })

    const { subscriptionId, invoiceUrl } = await createSubscription({
      customerId, plan, billingType: billingType ?? 'PIX', companyId: me.company_id,
    })

    await admin.from('companies').update({
      asaas_customer_id: customerId,
      asaas_subscription_id: subscriptionId,
      plan, plan_status: 'pending',
    }).eq('id', me.company_id)

    return NextResponse.json({ success: true, invoiceUrl })
  } catch (err) {
    console.error('asaas subscribe error:', err)
    return NextResponse.json({ error: (err as Error).message ?? 'Erro interno' }, { status: 500 })
  }
}
