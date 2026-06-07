import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Admin client com service_role bypassa confirmacao de email
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Rate limiting simples em memória: máx 5 tentativas por IP a cada 15 minutos
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

// Validação simples de email
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  try {
    // Rate limiting por IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' },
        { status: 429 }
      )
    }

    const { email, password, full_name, company_name } = await req.json()

    if (!email || !password || !full_name || !company_name) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios.' }, { status: 400 })
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
    }
    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter ao menos 6 caracteres.' }, { status: 400 })
    }
    if (typeof full_name !== 'string' || full_name.trim().length < 2) {
      return NextResponse.json({ error: 'Nome completo inválido.' }, { status: 400 })
    }
    if (typeof company_name !== 'string' || company_name.trim().length < 2) {
      return NextResponse.json({ error: 'Nome da empresa inválido.' }, { status: 400 })
    }

    const slug = company_name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    // 1. Criar usuario com admin (confirma automaticamente)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,  // confirma sem precisar de email
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message ?? 'Erro ao criar usuario' }, { status: 400 })
    }

    const userId = authData.user.id

    // 2. Criar empresa
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({ name: company_name, slug, plan: 'free', status: 'active' })
      .select()
      .single()

    if (companyError || !company) {
      // Rollback: remove usuario criado
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: 'Erro ao criar empresa. Tente outro nome.' }, { status: 400 })
    }

    // 3. Criar perfil admin
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id:         userId,
      company_id: company.id,
      full_name,
      email,
      role:       'adm_total',
      is_active:  true,
    })

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      await supabaseAdmin.from('companies').delete().eq('id', company.id)
      return NextResponse.json({ error: 'Erro ao criar perfil' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Register error:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}