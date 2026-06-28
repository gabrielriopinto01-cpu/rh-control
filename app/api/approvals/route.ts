import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { triggerAutomation } from '@/lib/automations'

export const dynamic = 'force-dynamic'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function getMe(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await admin.from('profiles').select('role, company_id').eq('id', user.id).single()
  return profile ? { ...profile, id: user.id } : null
}

// GET — lista pedidos de aprovação
export async function GET(req: NextRequest) {
  const me = await getMe(req)
  if (!me) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url    = new URL(req.url)
  const status = url.searchParams.get('status') ?? 'pending'
  const type   = url.searchParams.get('type')

  let q = admin
    .from('approval_requests')
    .select(`
      *,
      employee:employees(full_name, employee_code),
      requester:profiles!requester_id(email),
      actions:approval_actions(*, approver:profiles!approver_id(email))
    `)
    .eq('company_id', me.company_id)
    .order('created_at', { ascending: false })

  if (status !== 'all') q = q.eq('status', status)
  if (type) q = q.eq('type', type)

  // colaborador só vê os próprios
  if (me.role === 'colaborador') q = q.eq('requester_id', me.id)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — criar pedido
export async function POST(req: NextRequest) {
  const me = await getMe(req)
  if (!me) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const { type, employee_id, payload, reference_id } = body
  if (!type || !employee_id) return NextResponse.json({ error: 'Campos obrigatórios' }, { status: 400 })

  const { data, error } = await admin.from('approval_requests').insert({
    company_id: me.company_id, type, employee_id,
    requester_id: me.id, payload: payload ?? {}, reference_id: reference_id ?? null,
    status: 'pending', current_step: 0,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Dispara WhatsApp para RH/gestor quando nova solicitação chega
  const { data: emp } = await admin.from('employees').select('full_name').eq('id', employee_id).single()
  const TYPE_PT: Record<string, string> = {
    vacation: 'férias', time_adjustment: 'ajuste de ponto', leave: 'afastamento', other: 'solicitação',
  }
  triggerAutomation(me.company_id, 'approval_requested', {
    nome: emp?.full_name ?? '',
    tipo: TYPE_PT[type] ?? type,
  }, { employee_id })

  return NextResponse.json(data, { status: 201 })
}
