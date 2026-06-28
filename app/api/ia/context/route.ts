import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await admin
    .from('profiles')
    .select('company_id, role, full_name')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ context: '' })

  const companyId = profile.company_id
  const today     = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 7) + '-01'

  const [empRes, vacRes, approvalRes, okrRes, docRes, payRes, birthRes] = await Promise.allSettled([
    admin.from('employees').select('id, status, hire_date, birth_date').eq('company_id', companyId),
    admin.from('vacations').select('status').eq('company_id', companyId),
    admin.from('approval_requests').select('status, type').eq('company_id', companyId).eq('status', 'pending'),
    admin.from('okrs').select('status').eq('company_id', companyId),
    admin.from('documents').select('expires_at').eq('company_id', companyId).not('expires_at', 'is', null),
    admin.from('payrolls').select('total_gross, total_net, reference_month').eq('company_id', companyId).order('reference_month', { ascending: false }).limit(1),
    admin.from('employees').select('birth_date, full_name').eq('company_id', companyId).eq('status', 'active').not('birth_date', 'is', null),
  ])

  const employees  = (empRes.status === 'fulfilled' ? empRes.value.data : null) ?? []
  const vacations  = (vacRes.status === 'fulfilled' ? vacRes.value.data : null) ?? []
  const approvals  = (approvalRes.status === 'fulfilled' ? approvalRes.value.data : null) ?? []
  const okrs       = (okrRes.status === 'fulfilled' ? okrRes.value.data : null) ?? []
  const docs       = (docRes.status === 'fulfilled' ? docRes.value.data : null) ?? []
  const lastPayroll = (payRes.status === 'fulfilled' ? payRes.value.data?.[0] : null)
  const empBirths  = (birthRes.status === 'fulfilled' ? birthRes.value.data : null) ?? []

  const active    = employees.filter(e => e.status === 'active').length
  const terminated = employees.filter(e => e.status === 'terminated').length
  const newThisMonth = employees.filter(e => e.hire_date >= monthStart).length

  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  const expiringDocs = docs.filter(d => d.expires_at >= today && d.expires_at <= in30).length
  const expiredDocs  = docs.filter(d => d.expires_at < today).length

  // Aniversariantes próximos 7 dias
  const upcomingBirthdays = empBirths.filter(e => {
    const d = new Date(e.birth_date + 'T00:00:00')
    const thisYear = new Date(new Date().getFullYear(), d.getMonth(), d.getDate())
    const diff = Math.round((thisYear.getTime() - new Date().setHours(0,0,0,0)) / 86400000)
    return diff >= 0 && diff <= 7
  }).map(e => e.full_name)

  const context = `
## Contexto da Empresa (dados em tempo real — ${today})

**Equipe:**
- Colaboradores ativos: ${active}
- Desligados (total histórico): ${terminated}
- Admissões este mês: ${newThisMonth}

**Férias:**
- Pendentes de aprovação: ${vacations.filter(v => v.status === 'pending').length}
- Aprovadas (futuras): ${vacations.filter(v => v.status === 'approved').length}
- Usufruídas (histórico): ${vacations.filter(v => v.status === 'taken').length}

**Documentos:**
- Vencendo em 30 dias: ${expiringDocs}
- Já vencidos: ${expiredDocs}

**Aprovações pendentes:** ${approvals.length} (tipos: ${approvals.map((a: any) => a.type).join(', ') || 'nenhum'})

**OKRs:**
- Em andamento: ${okrs.filter((o: any) => o.status === 'on_track').length}
- Em risco: ${okrs.filter((o: any) => o.status === 'at_risk').length}
- Concluídos: ${okrs.filter((o: any) => o.status === 'done').length}

**Folha do mês ${lastPayroll?.reference_month ?? 'sem dados'}:**
- Bruto total: R$ ${lastPayroll ? Number(lastPayroll.total_gross).toLocaleString('pt-BR') : '—'}
- Líquido total: R$ ${lastPayroll ? Number(lastPayroll.total_net).toLocaleString('pt-BR') : '—'}

**Aniversariantes próximos 7 dias:** ${upcomingBirthdays.length > 0 ? upcomingBirthdays.join(', ') : 'Nenhum'}

**Usuário atual:** ${profile.full_name} (${profile.role})
`.trim()

  return NextResponse.json({ context })
}
