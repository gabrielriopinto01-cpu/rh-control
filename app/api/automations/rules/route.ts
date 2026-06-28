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

const DEFAULT_RULES = [
  {
    event:    'vacation_approved',
    template: '✅ Olá {{nome}}! Suas férias foram *aprovadas*.\n📅 Período: {{inicio}} a {{fim}} ({{dias}} dias)\nBom descanso! 🌴',
    send_to:  'employee',
  },
  {
    event:    'vacation_rejected',
    template: '❌ Olá {{nome}}, sua solicitação de férias de {{inicio}} a {{fim}} foi *recusada*.\n💬 Motivo: {{motivo}}\nEntre em contato com o RH para mais informações.',
    send_to:  'employee',
  },
  {
    event:    'approval_requested',
    template: '🔔 Nova solicitação de *{{tipo}}* aguardando aprovação.\n👤 Colaborador: {{nome}}\nAcesse o RH Control para aprovar ou reprovar.',
    send_to:  'rh',
  },
  {
    event:    'employee_admitted',
    template: '🎉 Bem-vindo(a) à equipe, {{nome}}!\nSeu acesso ao RH Control foi criado. Use o e-mail {{email}} para entrar em:\n🔗 {{url}}',
    send_to:  'employee',
  },
  {
    event:    'birthday',
    template: '🎂 Hoje é aniversário de *{{nome}}*! Mande uma mensagem de felicitações! 🎉',
    send_to:  'rh',
  },
  {
    event:    'document_expiring',
    template: '⚠️ O documento *{{documento}}* de {{nome}} vence em {{dias}} dias ({{data}}).\nAtualize antes do vencimento!',
    send_to:  'rh',
  },
  {
    event:    'payroll_closed',
    template: '💰 A folha de pagamento de *{{mes}}* foi fechada com {{total}} colaboradores.\nHolerites disponíveis para download no RH Control.',
    send_to:  'rh',
  },
]

async function getAuth(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await admin.from('profiles').select('company_id, role').eq('id', user.id).single()
  if (!profile || !['adm_total', 'rh'].includes(profile.role)) return null
  return profile as { company_id: string; role: string }
}

export async function GET(req: NextRequest) {
  const profile = await getAuth(req)
  if (!profile) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { data: rules } = await admin
    .from('automation_rules')
    .select('*')
    .eq('company_id', profile.company_id)
    .order('event')

  // Cria regras padrão se nenhuma existir
  if (!rules || rules.length === 0) {
    await admin.from('automation_rules').insert(
      DEFAULT_RULES.map(r => ({ ...r, company_id: profile.company_id }))
    )
    const { data: fresh } = await admin.from('automation_rules').select('*').eq('company_id', profile.company_id).order('event')
    return NextResponse.json(fresh ?? [])
  }

  // Busca logs recentes (últimas 24h)
  const since = new Date(Date.now() - 86400000).toISOString()
  const { data: logs } = await admin
    .from('automation_logs')
    .select('rule_id, status')
    .eq('company_id', profile.company_id)
    .gte('created_at', since)

  const logMap: Record<string, { sent: number; failed: number }> = {}
  for (const log of (logs ?? [])) {
    if (!logMap[log.rule_id]) logMap[log.rule_id] = { sent: 0, failed: 0 }
    if (log.status === 'sent') logMap[log.rule_id].sent++
    if (log.status === 'failed') logMap[log.rule_id].failed++
  }

  return NextResponse.json(rules.map(r => ({ ...r, _stats24h: logMap[r.id] ?? { sent: 0, failed: 0 } })))
}

export async function POST(req: NextRequest) {
  const profile = await getAuth(req)
  if (!profile) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json()
  const { data, error } = await admin
    .from('automation_rules')
    .insert({ ...body, company_id: profile.company_id })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const profile = await getAuth(req)
  if (!profile) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id, ...updates } = await req.json()
  const { data, error } = await admin
    .from('automation_rules')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
