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

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}
function fmtTime(ts: string | null | undefined) {
  if (!ts) return '--:--'
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new NextResponse('Não autenticado', { status: 401 })

    const { data: me } = await admin.from('profiles').select('role, company_id').eq('id', user.id).single()
    if (!me || !['adm_total', 'rh', 'gestor'].includes(me.role)) {
      return new NextResponse('Sem permissão', { status: 403 })
    }

    const url   = new URL(req.url)
    const month = url.searchParams.get('month') ?? new Date().toISOString().slice(0, 7)
    const empId = url.searchParams.get('employee_id')

    const [companyRes, empsRes] = await Promise.all([
      admin.from('companies').select('name, document, logo_url').eq('id', me.company_id).single(),
      empId
        ? admin.from('employees').select('id, full_name, employee_code, cpf, position_id').eq('id', empId).eq('company_id', me.company_id)
        : admin.from('employees').select('id, full_name, employee_code, cpf, position_id').eq('company_id', me.company_id).eq('status', 'active').order('full_name'),
    ])

    const company  = companyRes.data
    const emps     = empsRes.data ?? []
    const monthStart = `${month}-01`
    const monthEnd   = `${month}-31`

    const { data: records } = await admin
      .from('attendance_records')
      .select('*, attendance_punches(kind, punched_at, address)')
      .eq('company_id', me.company_id)
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date', { ascending: true })

    const byEmp: Record<string, typeof records> = {}
    for (const r of (records ?? [])) {
      if (!byEmp[r.employee_id]) byEmp[r.employee_id] = []
      byEmp[r.employee_id]!.push(r)
    }

    const rows = emps.map(e => ({
      employee: e,
      records: byEmp[e.id] ?? [],
    }))

    // Gera HTML
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Espelho de Ponto — ${month}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
  .header h1 { font-size: 14px; font-weight: bold; }
  .header p { font-size: 11px; color: #444; }
  .emp-block { page-break-inside: avoid; margin-bottom: 24px; border: 1px solid #ccc; border-radius: 4px; overflow: hidden; }
  .emp-header { background: #f0f0f0; padding: 6px 10px; display: flex; justify-content: space-between; font-weight: bold; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #e8e8e8; font-size: 10px; text-align: left; padding: 4px 8px; border-bottom: 1px solid #ccc; }
  td { padding: 4px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  .absent { background: #fff0f0; color: #c00; }
  .late   { background: #fffbe6; }
  .footer { margin-top: 40px; display: flex; gap: 80px; justify-content: center; }
  .sig    { text-align: center; width: 200px; }
  .sig-line { border-top: 1px solid #000; padding-top: 4px; margin-top: 40px; font-size: 10px; }
  @media print { body { font-size: 10px; } .no-print { display: none; } }
</style>
</head>
<body>
<div class="no-print" style="padding:12px;background:#f8f8f8;border-bottom:1px solid #ddd;display:flex;gap:12px;align-items:center">
  <strong>Espelho de Ponto — ${month}</strong>
  <button onclick="window.print()" style="padding:6px 16px;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px">🖨️ Imprimir / Salvar PDF</button>
</div>
<div style="padding:16px">
<div class="header">
  <h1>${company?.name ?? 'Empresa'}</h1>
  <p>CNPJ: ${company?.document ?? '—'} | Espelho de Frequência — ${new Date(month + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
  <p style="font-size:10px;margin-top:4px">Conforme Portaria MTE 671/2021 — Art. 74 CLT</p>
</div>

${rows.map(({ employee: e, records: recs }) => `
<div class="emp-block">
  <div class="emp-header">
    <span>${e.full_name} ${e.employee_code ? `(${e.employee_code})` : ''}</span>
    <span>CPF: ${e.cpf ?? '—'}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Data</th><th>Entrada</th><th>Saída almoço</th><th>Retorno</th><th>Saída</th><th>Situação</th><th>Horas trab.</th>
      </tr>
    </thead>
    <tbody>
    ${recs.length === 0 ? `<tr><td colspan="7" style="color:#aaa;text-align:center;padding:8px">Sem registros</td></tr>` :
      recs.map((r: any) => {
        const punches: any[] = r.attendance_punches ?? []
        const get = (kind: string) => punches.find((p: any) => p.kind === kind)?.punched_at ?? null
        const statusClass = r.status === 'absent' ? 'absent' : r.status === 'late' ? 'late' : ''
        const statusLabel = r.status === 'present' ? 'Presente' : r.status === 'absent' ? 'Falta' : r.status === 'late' ? 'Atraso' : r.status ?? '—'
        const workedMin = r.worked_minutes ?? 0
        const workedH = `${Math.floor(workedMin/60)}h${String(workedMin%60).padStart(2,'0')}`
        return `<tr class="${statusClass}">
          <td>${fmtDate(r.date)}</td>
          <td>${fmtTime(get('in'))}</td>
          <td>${fmtTime(get('lunch_start'))}</td>
          <td>${fmtTime(get('lunch_end'))}</td>
          <td>${fmtTime(get('out'))}</td>
          <td>${statusLabel}</td>
          <td>${workedMin > 0 ? workedH : '—'}</td>
        </tr>`
      }).join('')}
    </tbody>
  </table>
</div>
`).join('')}

<div class="footer">
  <div class="sig"><div class="sig-line">Assinatura do Empregador</div></div>
  <div class="sig"><div class="sig-line">Assinatura do Empregado</div></div>
</div>
<p style="text-align:center;font-size:9px;margin-top:16px;color:#888">Gerado em ${new Date().toLocaleString('pt-BR')} — RH Control</p>
</div>
</body>
</html>`

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (err) {
    console.error('espelho-ponto error:', err)
    return new NextResponse('Erro interno', { status: 500 })
  }
}
