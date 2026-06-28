// Integração com o ASAAS (pagamento SaaS) — server-side.
// Configurar no .env.local:
//   ASAAS_API_KEY=sua_chave
//   ASAAS_ENV=sandbox   (ou 'production')

export function isAsaasConfigured(): boolean {
  return !!process.env.ASAAS_API_KEY
}

const baseUrl = () =>
  process.env.ASAAS_ENV === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3'

async function asaas(path: string, init?: RequestInit) {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      access_token: process.env.ASAAS_API_KEY!,
      ...(init?.headers ?? {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.errors?.[0]?.description ?? 'Erro na API do Asaas'
    throw new Error(msg)
  }
  return data
}

export const ASAAS_PLAN_VALUES: Record<string, { value: number; name: string }> = {
  starter:      { value: 97,  name: 'RH Control — Starter' },
  professional: { value: 197, name: 'RH Control — Professional' },
  enterprise:   { value: 497, name: 'RH Control — Enterprise' },
}

/** Cria (ou retorna) o cliente Asaas. */
export async function ensureCustomer(input: {
  existingId?: string | null; name: string; email: string; cpfCnpj: string
}): Promise<string> {
  if (input.existingId) return input.existingId
  const c = await asaas('/customers', {
    method: 'POST',
    body: JSON.stringify({ name: input.name, email: input.email, cpfCnpj: input.cpfCnpj.replace(/\D/g, '') }),
  })
  return c.id as string
}

/** Cria uma assinatura mensal e retorna { subscriptionId, invoiceUrl }. */
export async function createSubscription(input: {
  customerId: string; plan: string; billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD'; companyId: string
}): Promise<{ subscriptionId: string; invoiceUrl: string | null }> {
  const plan = ASAAS_PLAN_VALUES[input.plan]
  if (!plan) throw new Error('Plano inválido')

  const nextDue = new Date(Date.now() + 86400000).toISOString().slice(0, 10) // amanhã
  const sub = await asaas('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      customer: input.customerId,
      billingType: input.billingType,
      value: plan.value,
      nextDueDate: nextDue,
      cycle: 'MONTHLY',
      description: plan.name,
      externalReference: input.companyId,
    }),
  })

  // Busca a primeira cobrança para obter o link de pagamento
  let invoiceUrl: string | null = null
  try {
    const payments = await asaas(`/subscriptions/${sub.id}/payments`)
    invoiceUrl = payments?.data?.[0]?.invoiceUrl ?? null
  } catch { /* ignora */ }

  return { subscriptionId: sub.id as string, invoiceUrl }
}
