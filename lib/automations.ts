/**
 * Helper para disparar automações de WhatsApp a partir de routes de API.
 * Fire-and-forget — nunca bloqueia o fluxo principal.
 */

type AutomationEvent =
  | 'vacation_approved'
  | 'vacation_rejected'
  | 'approval_requested'
  | 'employee_admitted'
  | 'birthday'
  | 'document_expiring'
  | 'payroll_closed'

export async function triggerAutomation(
  companyId: string,
  event: AutomationEvent,
  variables: Record<string, string>,
  opts?: { employee_id?: string; manager_id?: string }
): Promise<void> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const secret = process.env.INTERNAL_API_SECRET ?? 'dev'

  try {
    await fetch(`${base}/api/automations/trigger`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': secret,
      },
      body: JSON.stringify({
        company_id: companyId,
        event,
        variables,
        employee_id: opts?.employee_id,
        manager_id:  opts?.manager_id,
      }),
    })
  } catch {
    // fire-and-forget — silently ignore failures
  }
}
