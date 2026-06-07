import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getStripe } from '@/lib/stripe/config'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'NÃ£o autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id, companies(stripe_customer_id)')
      .eq('id', user.id)
      .single()

    const customerId = (profile as any)?.companies?.stripe_customer_id
    if (!customerId) return NextResponse.json({ error: 'Sem assinatura ativa' }, { status: 400 })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    const session = await getStripe().billingPortal.sessions.create({
      customer:   customerId,
      return_url: `${appUrl}/settings?tab=plano`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Stripe portal error:', err)
    return NextResponse.json({ error: 'Erro ao abrir portal' }, { status: 500 })
  }
}


