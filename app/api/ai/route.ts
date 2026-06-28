import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const MODEL = 'claude-sonnet-4-6'

const SYSTEM_PROMPTS: Record<string, string> = {
  job_description:
    'Você é um especialista em RH brasileiro. Gere uma descrição de cargo completa e profissional em português do Brasil, com: resumo do cargo, principais responsabilidades (lista), requisitos/qualificações (lista) e competências comportamentais. Seja objetivo e use linguagem corporativa.',
  employee_summary:
    'Você é um analista de RH. A partir dos dados fornecidos, escreva um resumo profissional e conciso do colaborador em português do Brasil, destacando pontos relevantes para gestão de pessoas.',
  absenteeism:
    'Você é um analista de RH especializado em indicadores. A partir dos dados fornecidos, analise o absenteísmo, aponte possíveis causas e sugira ações práticas. Responda em português do Brasil, de forma estruturada.',
  feedback:
    'Você é um líder experiente. Gere um feedback construtivo, equilibrado e respeitoso em português do Brasil a partir do contexto fornecido, com pontos fortes, pontos de melhoria e sugestões de desenvolvimento.',
  free:
    'Você é um assistente de RH prestativo e objetivo. Responda em português do Brasil.',
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'IA não configurada. Adicione ANTHROPIC_API_KEY no .env.local.' },
        { status: 503 }
      )
    }

    const { mode, prompt } = await req.json() as { mode?: string; prompt?: string }
    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Informe o conteúdo' }, { status: 400 })
    }

    const system = SYSTEM_PROMPTS[mode ?? 'free'] ?? SYSTEM_PROMPTS.free

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const txt = await res.text()
      console.error('Anthropic error:', txt)
      return NextResponse.json({ error: 'Falha ao gerar resposta da IA' }, { status: 502 })
    }

    const data = await res.json()
    const text = Array.isArray(data?.content)
      ? data.content.filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('\n')
      : ''

    return NextResponse.json({ text })
  } catch (err) {
    console.error('ai route error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
