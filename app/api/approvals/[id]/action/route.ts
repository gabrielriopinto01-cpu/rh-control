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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
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

    const { action, comment } = await req.json() // action: 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }

    const { data: req_ } = await admin.from('approval_requests').select('*').eq('id', id).eq('company_id', me.company_id).single()
    if (!req_ || req_.status !== 'pending') {
      return NextResponse.json({ error: 'Pedido não encontrado ou já resolvido' }, { status: 404 })
    }

    // Grava ação
    await admin.from('approval_actions').insert({
      request_id: id, approver_id: user.id, approver_role: me.role,
      step: req_.current_step, action, comment: comment ?? null,
    })

    const newStatus = action === 'reject' ? 'rejected' : 'approved'
    await admin.from('approval_requests').update({
      status: newStatus,
      rejection_reason: action === 'reject' ? (comment ?? null) : null,
      resolved_at: new Date().toISOString(),
    }).eq('id', id)

    // Se aprovação de férias, atualiza status na tabela vacations + dispara WhatsApp
    if (req_.type === 'vacation' && req_.reference_id) {
      const payload = req_.payload as Record<string, string> | null ?? {}
      if (action === 'approve') {
        await admin.from('vacations').update({ status: 'approved', approved_by_name: me.role }).eq('id', req_.reference_id)
        // busca nome do colaborador para a variável {{nome}}
        const { data: emp } = await admin.from('employees').select('full_name').eq('id', req_.employee_id).single()
        triggerAutomation(me.company_id, 'vacation_approved', {
          nome:   emp?.full_name ?? '',
          inicio: payload.start_date ?? '',
          fim:    payload.end_date ?? '',
          dias:   String(payload.days ?? ''),
        }, { employee_id: req_.employee_id })
      }
      if (action === 'reject') {
        await admin.from('vacations').update({ status: 'rejected' }).eq('id', req_.reference_id)
        const { data: emp } = await admin.from('employees').select('full_name').eq('id', req_.employee_id).single()
        triggerAutomation(me.company_id, 'vacation_rejected', {
          nome:   emp?.full_name ?? '',
          inicio: payload.start_date ?? '',
          fim:    payload.end_date ?? '',
          motivo: comment ?? 'Não informado',
        }, { employee_id: req_.employee_id })
      }
    }

    return NextResponse.json({ ok: true, status: newStatus })
  } catch (err) {
    console.error('approval action error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
