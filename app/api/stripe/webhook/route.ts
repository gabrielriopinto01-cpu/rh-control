import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/config'
import { createClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

export const dynamic = 'force-dynamic'

// Supabase service role (bypassa RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function updateCompanyPlan(companyId: string, plan: string, status: string, sub: Stripe.Subscription) {
  await supabaseAdmin
    .from('companies')
    .update({
      plan,
      plan_status:          status,
      stripe_subscription_id: sub.id,
      plan_expires_at:      new Date((sub as any).current_period_end * 1000).toISOString(),
    })
    .eq('id', companyId)
}

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature')!
  const secret    = process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret)
  } catch (err) {
    console.error('Webhook signature invalid:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session  = event.data.object as Stripe.Checkout.Session
        const companyId = session.metadata?.company_id
        const planId    = session.metadata?.plan_id ?? 'starter'
        if (!companyId) break

        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string)
          await updateCompanyPlan(companyId, planId, 'active', sub)
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub       = event.data.object as Stripe.Subscription
        const companyId = sub.metadata?.company_id
        const planId    = sub.metadata?.plan_id ?? 'starter'
        if (!companyId) break

        const status = sub.status === 'active' ? 'active' :
                       sub.status === 'past_due' ? 'past_due' : 'inactive'
        await updateCompanyPlan(companyId, planId, status, sub)
        break
      }

      case 'customer.subscription.deleted': {
        const sub       = event.data.object as Stripe.Subscription
        const companyId = sub.metadata?.company_id
        if (!companyId) break

        await supabaseAdmin
          .from('companies')
          .update({ plan: 'free', plan_status: 'inactive', stripe_subscription_id: null })
          .eq('id', companyId)
        break
      }

      case 'invoice.payment_failed': {
        const invoice   = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        const { data: company } = await supabaseAdmin
          .from('companies')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()
        if (company) {
          await supabaseAdmin
            .from('companies')
            .update({ plan_status: 'past_due' })
            .eq('id', company.id)
        }
        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
