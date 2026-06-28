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

async function getPlatformAdmin(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: pa } = await admin.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle()
  return pa ? user : null
}

export async function PATCH(req: NextRequest) {
  const caller = await getPlatformAdmin(req)
  if (!caller) return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })

  try {
    const { companyId, action, plan } = await req.json()
    if (!companyId) return NextResponse.json({ error: 'companyId obrigatório' }, { status: 400 })

    if (action === 'block') {
      await admin.from('companies').update({ status: 'blocked' }).eq('id', companyId)
      return NextResponse.json({ ok: true })
    }
    if (action === 'activate') {
      await admin.from('companies').update({ status: 'active' }).eq('id', companyId)
      return NextResponse.json({ ok: true })
    }
    if (action === 'set_plan' && plan) {
      await admin.from('companies').update({ plan }).eq('id', companyId)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (err) {
    console.error('admin company patch error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
