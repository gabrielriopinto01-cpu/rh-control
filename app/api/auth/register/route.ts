import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Admin client com service_role bypassa confirmacao de email
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const { email, password, full_name, company_name } = await req.json()

    if (!email || !password || !full_name || !company_name) {
      return NextResponse.json({ error: 'Campos obrigatorios faltando' }, { status: 400 })
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