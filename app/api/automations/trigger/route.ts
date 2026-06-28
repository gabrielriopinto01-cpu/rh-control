/**
 * POST /api/automations/trigger
 * Chamado internamente quando um evento de RH ocorre.
 * Busca as regras ativas para o evento, monta a mensagem e envia via Evolution API.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

type TriggerPayload = {
  company_id:    string
  event:         string
  variables:     Record<string, string>  // {nome, data, cargo, etc.}
  employee_id?:  string
  manager_id?:   string
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
}

async function sendWhatsApp(phone: string, message: string, instanceName: string): Promise<boolean> {
  const url     = process.env.EVOLUTION_API_URL
  const apiKey  = process.env.EVOLUTION_API_KEY
  if (!url || !apiKey) return false

  const clean = phone.replace(/\D/g, '')
  if (clean.length < 10) return false

  try {
    const res = await fetch(`${url}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ number: `55${clean}`, text: message }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  // Valida segredo interno para evitar chamadas externas
  const secret = req.headers.get('x-internal-secret')
  if (secret !== process.env.INTERNAL_API_SECRET && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body: TriggerPayload = await req.json()
  const { company_id, event, variables, employee_id, manager_id } = body

  // Busca regras ativas para este evento
  const { data: rules } = await admin
    .from('automation_rules')
    .select('*')
    .eq('company_id', company_id)
    .eq('event', event)
    .eq('active', true)

  if (!rules || rules.length === 0) {
    return NextResponse.json({ triggered: 0 })
  }

  // Busca instância WhatsApp da empresa
  const { data: company } = await admin
    .from('companies')
    .select('whatsapp_instance')
    .eq('id', company_id)
    .single()
  const instance = (company as any)?.whatsapp_instance ?? ''

  let triggered = 0

  for (const rule of rules) {
    const message = interpolate(rule.template, variables)

    // Determina destinatário
    let targets: { name: string; phone: string }[] = []

    if (rule.send_to === 'employee' && employee_id) {
      const { data: emp } = await admin
        .from('employees')
        .select('full_name, phone')
        .eq('id', employee_id)
        .single()
      if (emp?.phone) targets.push({ name: emp.full_name, phone: emp.phone })
    }

    if ((rule.send_to === 'manager' || rule.send_to === 'all') && manager_id) {
      const { data: mgr } = await admin
        .from('profiles')
        .select('full_name, phone:employees(phone)')
        .eq('id', manager_id)
        .single()
      if ((mgr as any)?.phone) targets.push({ name: (mgr as any).full_name, phone: (mgr as any).phone })
    }

    if (rule.send_to === 'rh' || rule.send_to === 'all') {
      const { data: rhUsers } = await admin
        .from('profiles')
        .select('full_name, employees(phone)')
        .eq('company_id', company_id)
        .in('role', ['adm_total', 'rh'])
      for (const u of (rhUsers as any[]) ?? []) {
        const phone = u.employees?.phone
        if (phone) targets.push({ name: u.full_name, phone })
      }
    }

    for (const t of targets) {
      let status: 'sent' | 'failed' | 'skipped' = 'skipped'
      let error: string | undefined

      if (instance) {
        const ok = await sendWhatsApp(t.phone, message, instance)
        status = ok ? 'sent' : 'failed'
        if (!ok) error = 'Falha na API do WhatsApp'
      } else {
        status = 'skipped'
        error = 'Instância WhatsApp não configurada'
      }

      await admin.from('automation_logs').insert({
        company_id,
        rule_id: rule.id,
        event,
        recipient_name:  t.name,
        recipient_phone: t.phone,
        message,
        status,
        error: error ?? null,
      })

      if (status === 'sent') triggered++
    }
  }

  return NextResponse.json({ triggered })
}
