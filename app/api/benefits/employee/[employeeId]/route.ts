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

// GET — benefícios de um colaborador
export async function GET(_: NextRequest, { params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params
  const me = await getMe()
  if (!me) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data } = await admin
    .from('employee_benefits')
    .select('*, benefit:benefits(*)')
    .eq('employee_id', employeeId)
    .eq('company_id', me.company_id)
    .order('start_date', { ascending: false })

  return NextResponse.json(data ?? [])
}

// POST — vincular benefício a colaborador
export async function POST(req: NextRequest, { params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params
  const me = await getMe()
  if (!me) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!['adm_total', 'rh'].includes(me.role)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { benefit_id, start_date, end_date, notes } = await req.json()
  if (!benefit_id) return NextResponse.json({ error: 'benefit_id obrigatório' }, { status: 400 })

  const { data, error } = await admin.from('employee_benefits').insert({
    company_id: me.company_id,
    employee_id: employeeId,
    benefit_id,
    start_date: start_date ?? new Date().toISOString().slice(0, 10),
    end_date: end_date ?? null,
    notes: notes ?? null,
  }).select('*, benefit:benefits(*)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE — desvincular (por employee_benefit id no body)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params
  const me = await getMe()
  if (!me) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!['adm_total', 'rh'].includes(me.role)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await req.json()
  const { error } = await admin.from('employee_benefits').delete().eq('id', id).eq('employee_id', employeeId).eq('company_id', me.company_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
