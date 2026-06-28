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

// Retorna JSON com rows para o frontend renderizar e oferecer export CSV
export async function GET(req: NextRequest) {
  try {
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

    const url    = new URL(req.url)
    const report = url.searchParams.get('report') ?? 'employees'
    const from   = url.searchParams.get('from')
    const to     = url.searchParams.get('to')
    const dept   = url.searchParams.get('department_id')
    const status = url.searchParams.get('status')

    let rows: any[] = []
    let columns: string[] = []

    if (report === 'employees') {
      let q = admin
        .from('employees')
        .select('full_name, employee_code, cpf, position:positions(title), department:departments(name), hire_date, status, salary')
        .eq('company_id', me.company_id)
        .order('full_name')
      if (dept)   q = q.eq('department_id', dept)
      if (status) q = q.eq('status', status)
      const { data } = await q
      columns = ['Nome', 'Matrícula', 'CPF', 'Cargo', 'Departamento', 'Admissão', 'Status', 'Salário']
      rows = (data ?? []).map((e: any) => [
        e.full_name,
        e.employee_code ?? '',
        e.cpf ?? '',
        e.position?.title ?? '',
        e.department?.name ?? '',
        e.hire_date ? new Date(e.hire_date + 'T00:00:00').toLocaleDateString('pt-BR') : '',
        e.status,
        e.salary ? `R$ ${Number(e.salary).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '',
      ])
    } else if (report === 'vacations') {
      let q = admin
        .from('vacations')
        .select('employee:employees!inner(full_name, company_id), start_date, end_date, days, status, approved_by_name')
        .eq('employees.company_id', me.company_id)
        .order('start_date', { ascending: false })
      if (from) q = q.gte('start_date', from)
      if (to)   q = q.lte('end_date', to)
      const { data } = await q
      columns = ['Colaborador', 'Início', 'Fim', 'Dias', 'Status', 'Aprovado por']
      rows = (data ?? []).map((v: any) => [
        v.employee?.full_name ?? '',
        v.start_date ? new Date(v.start_date + 'T00:00:00').toLocaleDateString('pt-BR') : '',
        v.end_date   ? new Date(v.end_date   + 'T00:00:00').toLocaleDateString('pt-BR') : '',
        v.days,
        v.status,
        v.approved_by_name ?? '',
      ])
    } else if (report === 'attendance') {
      let q = admin
        .from('attendance_records')
        .select('employee:employees!inner(full_name, company_id), date, status, worked_minutes, overtime_minutes')
        .eq('employees.company_id', me.company_id)
        .order('date', { ascending: false })
      if (from) q = q.gte('date', from)
      if (to)   q = q.lte('date', to)
      if (dept) q = q.eq('employees.department_id', dept)
      const { data } = await q
      columns = ['Colaborador', 'Data', 'Status', 'Horas trab.', 'Horas extras']
      rows = (data ?? []).map((r: any) => {
        const toH = (m: number | null) => m ? `${Math.floor(m/60)}h${String(m%60).padStart(2,'0')}` : '—'
        return [
          r.employee?.full_name ?? '',
          r.date ? new Date(r.date + 'T00:00:00').toLocaleDateString('pt-BR') : '',
          r.status,
          toH(r.worked_minutes),
          toH(r.overtime_minutes),
        ]
      })
    } else if (report === 'payroll') {
      let q = admin
        .from('payroll_items')
        .select('employee:employees!inner(full_name, company_id), payroll:payrolls(reference_month), gross_salary, inss, irrf, fgts, net_salary')
        .eq('employees.company_id', me.company_id)
        .order('payrolls.reference_month', { ascending: false })
      if (from) q = q.gte('payrolls.reference_month', from)
      if (to)   q = q.lte('payrolls.reference_month', to)
      const { data } = await q
      columns = ['Colaborador', 'Mês referência', 'Salário bruto', 'INSS', 'IRRF', 'FGTS', 'Salário líquido']
      const brl = (n: number | null) => n != null ? `R$ ${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''
      rows = (data ?? []).map((p: any) => [
        p.employee?.full_name ?? '',
        p.payroll?.reference_month ?? '',
        brl(p.gross_salary),
        brl(p.inss),
        brl(p.irrf),
        brl(p.fgts),
        brl(p.net_salary),
      ])
    } else if (report === 'medical') {
      let q = admin
        .from('medical_certificates')
        .select('employee:employees!inner(full_name, company_id), issue_date, days_off, doctor_name, crm, cid, notes')
        .eq('employees.company_id', me.company_id)
        .order('issue_date', { ascending: false })
      if (from) q = q.gte('issue_date', from)
      if (to)   q = q.lte('issue_date', to)
      const { data } = await q
      columns = ['Colaborador', 'Data', 'Dias', 'Médico', 'CRM', 'CID', 'Observações']
      rows = (data ?? []).map((m: any) => [
        m.employee?.full_name ?? '',
        m.issue_date ? new Date(m.issue_date + 'T00:00:00').toLocaleDateString('pt-BR') : '',
        m.days_off ?? '',
        m.doctor_name ?? '',
        m.crm ?? '',
        m.cid ?? '',
        m.notes ?? '',
      ])
    }

    else if (report === 'birthdays') {
      const { data } = await admin
        .from('employees')
        .select('full_name, birth_date, department:departments(name), position:positions(title), status')
        .eq('company_id', me.company_id)
        .not('birth_date', 'is', null)
        .order('full_name')
      const today = new Date()
      columns = ['Nome', 'Departamento', 'Cargo', 'Data Nasc.', 'Aniversário (este ano)', 'Dias para aniversário']
      rows = (data ?? []).filter((e: any) => e.status === 'active').map((e: any) => {
        const d = new Date(e.birth_date + 'T00:00:00')
        const thisYear = new Date(today.getFullYear(), d.getMonth(), d.getDate())
        const diff = Math.round((thisYear.getTime() - today.setHours(0,0,0,0)) / 86400000)
        const daysLabel = diff < 0 ? `${diff + 365}d (próximo ano)` : diff === 0 ? 'Hoje! 🎉' : `${diff}d`
        return [
          e.full_name,
          (e.department as any)?.name ?? '',
          (e.position as any)?.title ?? '',
          d.toLocaleDateString('pt-BR'),
          thisYear.toLocaleDateString('pt-BR'),
          daysLabel,
        ]
      }).sort((a: any[], b: any[]) => {
        const da = parseInt(a[5]) || 999
        const db = parseInt(b[5]) || 999
        return da - db
      })
    }

    else if (report === 'benefits') {
      const { data } = await admin
        .from('employee_benefits')
        .select('employee:employees!inner(full_name, company_id), benefit:benefits(name, type, value, employee_discount), start_date')
        .eq('employees.company_id', me.company_id)
        .is('end_date', null)
        .order('employees.full_name')
      columns = ['Colaborador', 'Benefício', 'Tipo', 'Valor Empresa', 'Desconto Colaborador', 'Início']
      const TYPE: Record<string, string> = { vt: 'Vale-Transporte', vr: 'Vale-Refeição', health: 'Plano de Saúde', dental: 'Plano Odontológico', life_insurance: 'Seguro de Vida', gym: 'Academia', other: 'Outro' }
      const brl = (n: any) => n != null ? `R$ ${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''
      rows = (data ?? []).map((eb: any) => [
        eb.employee?.full_name ?? '',
        eb.benefit?.name ?? '',
        TYPE[eb.benefit?.type] ?? eb.benefit?.type ?? '',
        brl(eb.benefit?.value),
        brl(eb.benefit?.employee_discount),
        eb.start_date ? new Date(eb.start_date + 'T00:00:00').toLocaleDateString('pt-BR') : '',
      ])
    }

    else if (report === 'okrs') {
      const { data: okrData } = await admin
        .from('okrs')
        .select('objective, cycle, status, employee:employees(full_name), key_results(description, target, current, unit, status)')
        .eq('company_id', me.company_id)
        .order('cycle', { ascending: false })
      columns = ['Objetivo', 'Ciclo', 'Status OKR', 'Colaborador', 'KR', 'Meta', 'Atual', 'Unidade', 'Status KR']
      rows = []
      for (const okr of (okrData ?? []) as any[]) {
        const krs = okr.key_results ?? []
        if (krs.length === 0) {
          rows.push([okr.objective, okr.cycle, okr.status, okr.employee?.full_name ?? 'Empresa', '', '', '', '', ''])
        } else {
          for (const kr of krs) {
            rows.push([okr.objective, okr.cycle, okr.status, okr.employee?.full_name ?? 'Empresa', kr.description, kr.target, kr.current, kr.unit, kr.status])
          }
        }
      }
    }

    else if (report === 'trainings') {
      let q = admin
        .from('training_completions')
        .select('employee:employees!inner(full_name, company_id), training:trainings(title, category), completed_at, score, notes')
        .eq('employees.company_id', me.company_id)
        .order('completed_at', { ascending: false })
      if (from) q = q.gte('completed_at', from)
      if (to)   q = q.lte('completed_at', to)
      const { data } = await q
      columns = ['Colaborador', 'Treinamento', 'Categoria', 'Concluído em', 'Nota', 'Observações']
      rows = (data ?? []).map((tc: any) => [
        tc.employee?.full_name ?? '',
        tc.training?.title ?? '',
        tc.training?.category ?? '',
        tc.completed_at ? new Date(tc.completed_at).toLocaleDateString('pt-BR') : '',
        tc.score ?? '',
        tc.notes ?? '',
      ])
    }

    else if (report === 'turnover') {
      let q = admin
        .from('employees')
        .select('full_name, hire_date, termination_date, department:departments(name), position:positions(title), status')
        .eq('company_id', me.company_id)
        .not('termination_date', 'is', null)
        .order('termination_date', { ascending: false })
      if (from) q = q.gte('termination_date', from)
      if (to)   q = q.lte('termination_date', to)
      const { data: terminated } = await q

      const { data: allActive } = await admin
        .from('employees')
        .select('id')
        .eq('company_id', me.company_id)
        .eq('status', 'active')

      const total   = (allActive?.length ?? 0) + (terminated?.length ?? 0)
      const percent = total > 0 ? ((terminated?.length ?? 0) / total * 100).toFixed(1) : '0'

      columns = ['Colaborador', 'Departamento', 'Cargo', 'Admissão', 'Desligamento', 'Tempo de casa (dias)']
      rows = (terminated ?? []).map((e: any) => {
        const hire = new Date(e.hire_date + 'T00:00:00')
        const term = new Date(e.termination_date + 'T00:00:00')
        const days = Math.round((term.getTime() - hire.getTime()) / 86400000)
        return [
          e.full_name,
          (e.department as any)?.name ?? '',
          (e.position as any)?.title ?? '',
          hire.toLocaleDateString('pt-BR'),
          term.toLocaleDateString('pt-BR'),
          days,
        ]
      })

      // Adiciona linha de resumo
      if (rows.length > 0) {
        rows.push(['──────────────', '', '', '', '── TURNOVER ──', `${percent}% (${terminated?.length ?? 0} de ${total})`])
      }
    }

    else if (report === 'absenteeism') {
      let q = admin
        .from('attendance_records')
        .select('date, status, employee:employees(full_name, department:departments(name))')
        .eq('company_id', me.company_id)
        .in('status', ['absent', 'late'])
        .order('date', { ascending: false })
      if (from) q = q.gte('date', from)
      if (to)   q = q.lte('date', to)
      const { data: records } = await q

      columns = ['Colaborador', 'Departamento', 'Data', 'Ocorrência']
      rows = (records ?? []).map((r: any) => [
        r.employee?.full_name ?? '',
        r.employee?.department?.name ?? '',
        new Date(r.date + 'T00:00:00').toLocaleDateString('pt-BR'),
        r.status === 'absent' ? 'Falta' : 'Atraso',
      ])
    }

    else if (report === 'warnings') {
      let q = admin
        .from('employee_warnings')
        .select('occurrence_date, type, severity, status, description, employee:employees(full_name, department:departments(name))')
        .eq('company_id', me.company_id)
        .order('occurrence_date', { ascending: false })
      if (from) q = q.gte('occurrence_date', from)
      if (to)   q = q.lte('occurrence_date', to)
      const { data: warns } = await q

      const TYPE_LABELS: Record<string, string> = {
        verbal: 'Advertência Verbal', written: 'Advertência Escrita',
        suspension: 'Suspensão', termination_cause: 'Demissão Justa Causa',
      }
      const SEV_LABELS: Record<string, string> = {
        low: 'Leve', medium: 'Média', high: 'Grave', critical: 'Gravíssima',
      }
      columns = ['Colaborador', 'Departamento', 'Data', 'Tipo', 'Gravidade', 'Status']
      rows = (warns ?? []).map((w: any) => [
        (w.employee as any)?.full_name ?? '',
        (w.employee as any)?.department?.name ?? '',
        new Date(w.occurrence_date + 'T00:00:00').toLocaleDateString('pt-BR'),
        TYPE_LABELS[w.type] ?? w.type,
        SEV_LABELS[w.severity] ?? w.severity,
        w.status,
      ])
    }

    else if (report === 'salary') {
      let q = admin
        .from('salary_history')
        .select('effective_date, salary, reason, employee:employees(full_name, department:departments(name), position:positions(title))')
        .order('effective_date', { ascending: false })
      // Filter by company via employee join — use RLS + subquery approach
      const { data: emps } = await admin.from('employees').select('id').eq('company_id', me.company_id)
      const empIds = (emps ?? []).map((e: any) => e.id)
      if (empIds.length === 0) { columns = ['Sem dados']; rows = [] }
      else {
        let qF = admin.from('salary_history')
          .select('effective_date, salary, reason, employee:employees(full_name, department:departments(name), position:positions(title))')
          .in('employee_id', empIds)
          .order('effective_date', { ascending: false })
        if (from) qF = qF.gte('effective_date', from)
        if (to)   qF = qF.lte('effective_date', to)
        const { data: hist } = await qF
        columns = ['Colaborador', 'Departamento', 'Cargo', 'Data', 'Salário', 'Motivo']
        rows = (hist ?? []).map((h: any) => [
          h.employee?.full_name ?? '',
          h.employee?.department?.name ?? '',
          h.employee?.position?.title ?? '',
          new Date(h.effective_date + 'T00:00:00').toLocaleDateString('pt-BR'),
          Number(h.salary).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          h.reason ?? '',
        ])
      }
    }

    return NextResponse.json({ columns, rows, total: rows.length })
  } catch (err) {
    console.error('report builder error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
