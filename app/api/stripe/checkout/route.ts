import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { stripe, PLANS, type PlanId } from '@/lib/stripe/config'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { planId } = await req.json() as { planId: PlanId }

    const plan = PLANS[planId]
    if (!plan?.priceId) {
      return NextResponse.json({ error: 'Plano inválido ou não configurado' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    // Busca dados da empresa
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id, companies(name, stripe_customer_id)')
      .eq('id', user.id)
      .single()

    const company    = (profile as any)?.companies
    const companyId  = profile?.company_id
    let customerId   = company?.stripe_customer_id as string | undefined

    // Cria customer no Stripe se não existir
    if (!customerId) {
      const customer = await stripe.customers.create({
        email:    user.email,
        name:     company?.name,
        metadata: { company_id: companyId ?? '', user_id: user.id },
      })
      customerId = customer.id

      await supabase
        .from('companies')
        .update({ stripe_customer_id: customerId })
        .eq('id', companyId)
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      customer:             customerId,
      mode:                 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price:    plan.priceId,
        quantity: 1,
      }],
      success_url: `${appUrl}/settings?tab=plano&success=1`,
      cancel_url:  `${appUrl}/pricing?canceled=1`,
      metadata: {
        company_id: companyId ?? '',
        plan_id:    planId,
      },
      subscription_data: {
        metadata: { company_id: companyId ?? '', plan_id: planId },
      },
      locale: 'pt-BR',
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: 'Erro ao criar sessão de pagamento' }, { status: 500 })
  }
}
