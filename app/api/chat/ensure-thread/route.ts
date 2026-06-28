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

async function addMembers(threadId: string, profileIds: string[]) {
  const rows = [...new Set(profileIds)].filter(Boolean).map(profile_id => ({ thread_id: threadId, profile_id }))
  if (rows.length === 0) return
  await admin.from('chat_thread_members').upsert(rows, { onConflict: 'thread_id,profile_id' })
}

export async function POST(req: NextRequest) {
  try {
    const { kind, departmentId, targetProfileId } = await req.json()

    // ── Identifica o chamador ──
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user: caller } } = await supabase.auth.getUser()
    if (!caller) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: me } = await admin
      .from('profiles')
      .select('id, role, company_id')
      .eq('id', caller.id)
      .single()
    if (!me) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

    // Apenas adm/rh/gestor podem iniciar conversas
    if (!['adm_total', 'rh', 'gestor'].includes(me.role)) {
      return NextResponse.json({ error: 'Sem permissão para iniciar conversas' }, { status: 403 })
    }

    const companyId = me.company_id

    // Perfis de gestão da empresa (sempre participam das conversas coletivas)
    const { data: managers } = await admin
      .from('profiles')
      .select('id')
      .eq('company_id', companyId)
      .in('role', ['adm_total', 'rh'])
    const managerIds = (managers ?? []).map(m => m.id)

    // ─────────────────────────────────────────── COMPANY (todos)
    if (kind === 'company') {
      let { data: thread } = await admin.from('chat_threads')
        .select('id').eq('company_id', companyId).eq('kind', 'company').maybeSingle()
      if (!thread) {
        const { data: ins } = await admin.from('chat_threads')
          .insert({ company_id: companyId, kind: 'company', title: 'Todos os colaboradores', created_by: me.id })
          .select('id').single()
        thread = ins
      }
      if (!thread) return NextResponse.json({ error: 'Erro ao criar conversa' }, { status: 500 })

      // Sincroniza membros = todos os perfis ativos da empresa
      const { data: all } = await admin.from('profiles')
        .select('id').eq('company_id', companyId).eq('is_active', true)
      await addMembers(thread.id, (all ?? []).map(p => p.id))
      return NextResponse.json({ threadId: thread.id })
    }

    // ─────────────────────────────────────────── DEPARTMENT (setor)
    if (kind === 'department') {
      if (!departmentId) return NextResponse.json({ error: 'departmentId obrigatório' }, { status: 400 })

      let { data: thread } = await admin.from('chat_threads')
        .select('id').eq('department_id', departmentId).eq('kind', 'department').maybeSingle()
      if (!thread) {
        const { data: dept } = await admin.from('departments').select('name').eq('id', departmentId).single()
        const { data: ins } = await admin.from('chat_threads')
          .insert({ company_id: companyId, kind: 'department', department_id: departmentId,
                    title: dept?.name ?? 'Departamento', created_by: me.id })
          .select('id').single()
        thread = ins
      }
      if (!thread) return NextResponse.json({ error: 'Erro ao criar conversa' }, { status: 500 })

      // Membros = colaboradores com acesso vinculados a esse depto + gestão
      const { data: deptEmps } = await admin.from('employees')
        .select('profile_id').eq('department_id', departmentId).not('profile_id', 'is', null)
      const ids = [...(deptEmps ?? []).map(e => e.profile_id as string), ...managerIds]
      await addMembers(thread.id, ids)
      return NextResponse.json({ threadId: thread.id })
    }

    // ─────────────────────────────────────────── DIRECT (1:1)
    if (kind === 'direct') {
      if (!targetProfileId) return NextResponse.json({ error: 'targetProfileId obrigatório' }, { status: 400 })

      // Procura thread direta já existente entre os dois
      const { data: myDirects } = await admin.from('chat_thread_members')
        .select('thread_id, chat_threads!inner(kind)')
        .eq('profile_id', me.id)
        .eq('chat_threads.kind', 'direct')
      const myThreadIds = (myDirects ?? []).map((r: any) => r.thread_id)

      if (myThreadIds.length > 0) {
        const { data: shared } = await admin.from('chat_thread_members')
          .select('thread_id')
          .eq('profile_id', targetProfileId)
          .in('thread_id', myThreadIds)
        if (shared && shared.length > 0) {
          return NextResponse.json({ threadId: shared[0].thread_id })
        }
      }

      // Cria nova thread direta
      const { data: ins } = await admin.from('chat_threads')
        .insert({ company_id: companyId, kind: 'direct', created_by: me.id })
        .select('id').single()
      if (!ins) return NextResponse.json({ error: 'Erro ao criar conversa' }, { status: 500 })
      await addMembers(ins.id, [me.id, targetProfileId])
      return NextResponse.json({ threadId: ins.id })
    }

    return NextResponse.json({ error: 'kind inválido' }, { status: 400 })
  } catch (err) {
    console.error('ensure-thread error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
