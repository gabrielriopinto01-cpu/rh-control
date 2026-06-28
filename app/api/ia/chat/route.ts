import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const BASE_SYSTEM = `Você é o Assistente IA do RH Control, sistema de gestão de RH brasileiro.
Auxilie profissionais de RH, gestores e colaboradores com clareza e precisão em português do Brasil.
Contexto: CLT, eSocial, normas trabalhistas brasileiras.
Formate respostas em Markdown (listas, negrito, cabeçalhos) quando isso melhorar a leitura.
Quando tiver dados da empresa disponíveis no contexto, use-os para respostas personalizadas e específicas.`

const TOOL_INSTRUCTIONS: Record<string, string> = {
  chat:               '',
  job_description:    'Gere uma descrição de cargo completa: responsabilidades, requisitos técnicos, competências comportamentais e nível de experiência. Use formato estruturado com seções.',
  feedback:           'Escreva um feedback construtivo baseado no modelo SCI (Situação-Comportamento-Impacto). Seja específico, equilibrado e orientado ao crescimento.',
  announcement:       'Redija um comunicado interno profissional e claro. Use linguagem respeitosa, informe o quê, por quê, quando e como os colaboradores serão afetados.',
  absenteeism:        'Analise o cenário de absenteísmo: calcule taxa, identifique padrões, aponte causas prováveis e sugira ações corretivas concretas (curto e médio prazo).',
  performance_review: 'Produza um rascunho de avaliação de desempenho estruturado: pontos fortes, áreas de melhoria, metas atingidas e sugestões de desenvolvimento. Tom construtivo.',
  candidate_summary:  'Analise o candidato: resuma experiência, identifique pontos fortes e riscos, compare com os requisitos típicos do cargo e dê uma recomendação objetiva.',
  clt_question:       'Responda a dúvida trabalhista com precisão e linguagem acessível. Cite os artigos da CLT relevantes, resolução do MTE ou jurisprudência TST quando aplicável. Se houver divergência doutrinária, mencione. Sempre recomende consulta a advogado trabalhista para casos específicos.',
  survey_questions:   'Crie perguntas para pesquisa de clima organizacional. Use escala Likert (1-5), misture questões fechadas e abertas. Organize em categorias: liderança, comunicação, ambiente, remuneração, desenvolvimento, bem-estar. Inclua pelo menos 1 pergunta NPS (Net Promoter Score interno).',
  salary_benchmark:   'Forneça um benchmark salarial baseado em dados de mercado brasileiro. Apresente: faixa mínima/mediana/máxima por nível (júnior/pleno/sênior), variações por região e porte de empresa, benefícios típicos do mercado, e tendências salariais para o cargo/setor mencionado. Use dados de pesquisas como Robert Half, Catho, Glassdoor e IBGE.',
}

async function fetchCompanyContext(companyId: string, role: string, userName: string): Promise<string> {
  const today      = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 7) + '-01'
  const in30       = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  const [empRes, vacRes, approvalRes, okrRes, docRes, payRes, birthRes, trainRes] = await Promise.allSettled([
    admin.from('employees').select('status, hire_date').eq('company_id', companyId),
    admin.from('vacations').select('status').eq('company_id', companyId),
    admin.from('approval_requests').select('type').eq('company_id', companyId).eq('status', 'pending'),
    admin.from('okrs').select('status').eq('company_id', companyId),
    admin.from('documents').select('expires_at').eq('company_id', companyId).not('expires_at', 'is', null),
    admin.from('payrolls').select('total_gross, total_net, reference_month').eq('company_id', companyId)
      .order('reference_month', { ascending: false }).limit(1),
    admin.from('employees').select('full_name, birth_date').eq('company_id', companyId).eq('status', 'active').not('birth_date', 'is', null),
    admin.from('training_completions').select('id').eq('company_id', companyId),
  ])

  const emps      = (empRes.status      === 'fulfilled' ? empRes.value.data      : null) ?? []
  const vacs      = (vacRes.status      === 'fulfilled' ? vacRes.value.data      : null) ?? []
  const approvals = (approvalRes.status === 'fulfilled' ? approvalRes.value.data : null) ?? []
  const okrs      = (okrRes.status      === 'fulfilled' ? okrRes.value.data      : null) ?? []
  const docs      = (docRes.status      === 'fulfilled' ? docRes.value.data      : null) ?? []
  const payroll   = (payRes.status      === 'fulfilled' ? payRes.value.data?.[0] : null)
  const birthEmps = (birthRes.status    === 'fulfilled' ? birthRes.value.data    : null) ?? []

  const active       = emps.filter((e: any) => e.status === 'active').length
  const newMonth     = emps.filter((e: any) => e.hire_date >= monthStart).length
  const expiring     = docs.filter((d: any) => d.expires_at >= today && d.expires_at <= in30).length
  const expired      = docs.filter((d: any) => d.expires_at < today).length

  const birthdays7d = birthEmps.filter((e: any) => {
    const d = new Date(e.birth_date + 'T00:00:00')
    const next = new Date(new Date().getFullYear(), d.getMonth(), d.getDate())
    const diff = Math.round((next.getTime() - new Date().setHours(0,0,0,0)) / 86400000)
    return diff >= 0 && diff <= 7
  }).map((e: any) => e.full_name)

  const brl = (n: any) => n != null ? `R$ ${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'

  return `
## Dados da Empresa em Tempo Real (${today})

**Equipe:** ${active} colaboradores ativos | ${newMonth} admissão(ões) este mês
**Férias:** ${vacs.filter((v: any) => v.status === 'pending').length} pendentes · ${vacs.filter((v: any) => v.status === 'approved').length} aprovadas · ${vacs.filter((v: any) => v.status === 'taken').length} usufruídas
**Aprovações workflow:** ${approvals.length} pendentes (${[...new Set(approvals.map((a: any) => a.type))].join(', ') || 'nenhum'})
**OKRs:** ${okrs.filter((o: any) => o.status === 'on_track').length} no prazo · ${okrs.filter((o: any) => o.status === 'at_risk').length} em risco · ${okrs.filter((o: any) => o.status === 'done').length} concluídos
**Documentos:** ${expiring} vencendo em 30 dias · ${expired} vencidos
**Folha ${payroll?.reference_month ?? '—'}:** Bruto ${brl(payroll?.total_gross)} · Líquido ${brl(payroll?.total_net)}
**Aniversários (7 dias):** ${birthdays7d.length > 0 ? birthdays7d.join(', ') : 'nenhum'}
**Usuário:** ${userName} (${role})
`.trim()
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Chave da API de IA não configurada. Adicione ANTHROPIC_API_KEY no .env.local e reinicie o servidor.' }, { status: 503 })
  }

  const { messages, tool, includeContext } = await req.json() as {
    messages: { role: 'user' | 'assistant'; content: string }[]
    tool?: string
    includeContext?: boolean
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('company_id, role, full_name')
    .eq('id', user.id)
    .single()

  let systemPrompt = BASE_SYSTEM
  if (tool && TOOL_INSTRUCTIONS[tool]) {
    systemPrompt += `\n\n**Modo ativo:** ${TOOL_INSTRUCTIONS[tool]}`
  }

  // Injeta contexto da empresa no chat livre e no modo "chat"
  if (profile && (tool === 'chat' || !tool || includeContext)) {
    try {
      const ctx = await fetchCompanyContext(profile.company_id, profile.role, profile.full_name)
      systemPrompt += `\n\n${ctx}`
    } catch { /* contexto opcional — não bloqueia */ }
  }

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: systemPrompt,
      messages,
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    return NextResponse.json({ content: text })
  } catch (err: unknown) {
    console.error('IA chat error:', err)
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
