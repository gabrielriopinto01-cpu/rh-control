import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getResend, FROM_EMAIL } from '@/lib/resend/client'
import { welcomeEmail } from '@/lib/resend/templates'

export const dynamic = 'force-dynamic'

// Admin client (service_role) — cria usuário sem confirmação de e-mail
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Gera senha temporária forte e legível
function genPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const num   = '23456789'
  const pick  = (s: string, n: number) =>
    Array.from({ length: n }, () => s[Math.floor(Math.random() * s.length)]).join('')
  return `${pick(upper, 2)}${pick(lower, 4)}@${pick(num, 3)}`
}

export async function POST(req: NextRequest) {
  try {
    const { employeeId } = await req.json()
    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId obrigatório' }, { status: 400 })
    }

    // ── Identifica quem está chamando (deve ser adm_total ou rh) ──
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user: caller } } = await supabase.auth.getUser()
    if (!caller) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role, company_id')
      .eq('id', caller.id)
      .single()
    if (!callerProfile || !['adm_total', 'rh'].includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Sem permissão para conceder acesso' }, { status: 403 })
    }

    // ── Carrega o colaborador + nome da empresa ──
    const { data: emp } = await admin
      .from('employees')
      .select('id, full_name, email, company_id, department_id, profile_id, company:companies(name)')
      .eq('id', employeeId)
      .eq('company_id', callerProfile.company_id)
      .single()

    if (!emp) {
      return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 })
    }
    if (emp.profile_id) {
      return NextResponse.json({ error: 'Este colaborador já possui acesso.' }, { status: 409 })
    }
    if (!emp.email) {
      return NextResponse.json({ error: 'Colaborador sem e-mail cadastrado. Edite o cadastro e adicione um e-mail.' }, { status: 400 })
    }

    // ── Cria o usuário de autenticação ──
    const tempPassword = genPassword()
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: emp.email,
      password: tempPassword,
      email_confirm: true,
    })
    if (createErr || !created.user) {
      const msg = createErr?.message?.includes('already')
        ? 'Já existe um usuário com este e-mail.'
        : (createErr?.message ?? 'Erro ao criar acesso')
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    const newUserId = created.user.id

    // ── Cria o perfil (role colaborador, vinculado ao employee) ──
    const { error: profErr } = await admin.from('profiles').insert({
      id:          newUserId,
      company_id:  emp.company_id,
      employee_id: emp.id,
      full_name:   emp.full_name,
      email:       emp.email,
      role:        'colaborador',
      is_active:   true,
    })
    if (profErr) {
      await admin.auth.admin.deleteUser(newUserId)
      return NextResponse.json({ error: 'Erro ao criar perfil de acesso' }, { status: 400 })
    }

    // ── Vincula o profile_id no colaborador ──
    await admin.from('employees').update({ profile_id: newUserId }).eq('id', emp.id)

    // ── Garante threads de chat (empresa + departamento) e adiciona membro ──
    try {
      // Thread da empresa
      let { data: companyThread } = await admin
        .from('chat_threads')
        .select('id')
        .eq('company_id', emp.company_id)
        .eq('kind', 'company')
        .maybeSingle()
      if (!companyThread) {
        const { data: ins } = await admin.from('chat_threads')
          .insert({ company_id: emp.company_id, kind: 'company', title: 'Todos os colaboradores', created_by: caller.id })
          .select('id').single()
        companyThread = ins
      }
      if (companyThread) {
        await admin.from('chat_thread_members')
          .upsert({ thread_id: companyThread.id, profile_id: newUserId }, { onConflict: 'thread_id,profile_id' })
      }

      // Thread do departamento
      if (emp.department_id) {
        let { data: deptThread } = await admin
          .from('chat_threads')
          .select('id')
          .eq('department_id', emp.department_id)
          .eq('kind', 'department')
          .maybeSingle()
        if (!deptThread) {
          const { data: ins } = await admin.from('chat_threads')
            .insert({ company_id: emp.company_id, kind: 'department', department_id: emp.department_id, created_by: caller.id })
            .select('id').single()
          deptThread = ins
        }
        if (deptThread) {
          await admin.from('chat_thread_members')
            .upsert({ thread_id: deptThread.id, profile_id: newUserId }, { onConflict: 'thread_id,profile_id' })
        }
      }
    } catch (e) {
      console.error('Erro ao vincular threads de chat:', e)
      // não bloqueia a concessão de acesso
    }

    // ── Envia e-mail de boas-vindas (best-effort) ──
    let emailSent = false
    try {
      const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
      const { error: mailErr } = await getResend().emails.send({
        from:    FROM_EMAIL,
        to:      emp.email,
        subject: 'Seu acesso ao RH Control',
        html:    welcomeEmail({
          name:         emp.full_name,
          companyName:  (emp.company as any)?.name ?? 'sua empresa',
          loginUrl:     `${origin}/login`,
          tempPassword,
        }),
      })
      emailSent = !mailErr
    } catch {
      emailSent = false
    }

    return NextResponse.json({ success: true, email: emp.email, tempPassword, emailSent })
  } catch (err) {
    console.error('grant-access error:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
