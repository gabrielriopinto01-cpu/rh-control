import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { sendText, isWhatsappConfigured, instanceName } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    if (!isWhatsappConfigured()) {
      return NextResponse.json({ error: 'WhatsApp não configurado. Adicione as variáveis EVOLUTION_* no .env.local.' }, { status: 503 })
    }

    const { message, scope, departmentId, to } = await req.json() as {
      message?: string; scope?: 'all' | 'department' | 'one'; departmentId?: string; to?: string
    }
    if (!message?.trim()) return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })

    // Autenticação + permissão
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { data: me } = await admin.from('profiles').select('role, company_id').eq('id', user.id).single()
    if (!me || !['adm_total', 'rh', 'gestor'].includes(me.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Instância de WhatsApp da empresa
    const { data: company } = await admin.from('companies').select('whatsapp_instance').eq('id', me.company_id).single()
    const instance = company?.whatsapp_instance ?? instanceName(me.company_id)

    // Destinatários
    let phones: string[] = []
    if (scope === 'one' && to) {
      phones = [to]
    } else {
      let q = admin.from('employees').select('phone, department_id')
        .eq('company_id', me.company_id).eq('status', 'active').not('phone', 'is', null)
      if (scope === 'department' && departmentId) q = q.eq('department_id', departmentId)
      const { data } = await q
      phones = (data ?? []).map(e => e.phone as string).filter(Boolean)
    }

    if (phones.length === 0) {
      return NextResponse.json({ error: 'Nenhum colaborador com telefone cadastrado' }, { status: 400 })
    }

    let sent = 0, failed = 0
    for (const p of phones) {
      const ok = await sendText(instance, p, message)
      ok ? sent++ : failed++
    }

    return NextResponse.json({ success: true, sent, failed, total: phones.length })
  } catch (err) {
    console.error('whatsapp send error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
