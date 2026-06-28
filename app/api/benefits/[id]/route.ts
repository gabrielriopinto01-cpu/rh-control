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

async function getMe() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await admin.from('profiles').select('role, company_id').eq('id', user.id).single()
  return p ? { ...p, id: user.id } : null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getMe()
  if (!me) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!['adm_total', 'rh'].includes(me.role)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json()
  const { data, error } = await admin.from('benefits').update(body).eq('id', id).eq('company_id', me.company_id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getMe()
  if (!me) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!['adm_total', 'rh'].includes(me.role)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { error } = await admin.from('benefits').delete().eq('id', id).eq('company_id', me.company_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
