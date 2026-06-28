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

type CsvRow = {
  full_name: string; cpf?: string; email?: string; phone?: string
  birth_date?: string; hire_date?: string; position?: string; department?: string; salary?: string
}

function slug(str: string) { return str.toLowerCase().trim() }

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: profile } = await admin.from('profiles').select('role, company_id').eq('id', user.id).single()
    if (!profile || !['adm_total', 'rh'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }
    const companyId = profile.company_id

    const body = await req.json()
    const rows: CsvRow[] = body.rows ?? []
    if (!rows.length || rows.length > 500) {
      return NextResponse.json({ error: 'Entre 1 e 500 linhas' }, { status: 400 })
    }

    // Carrega departamentos e cargos existentes (ou cria novos)
    const { data: depts } = await admin.from('departments').select('id, name').eq('company_id', companyId)
    const { data: positions } = await admin.from('positions').select('id, title').eq('company_id', companyId)
    const deptMap   = new Map((depts ?? []).map(d => [slug(d.name), d.id]))
    const posMap    = new Map((positions ?? []).map(p => [slug(p.title), p.id]))

    const imported: string[] = []
    const errors: { row: number; name: string; error: string }[] = []

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!
      const rowNum = i + 2

      if (!r.full_name?.trim()) {
        errors.push({ row: rowNum, name: '—', error: 'Nome obrigatório' })
        continue
      }

      // Resolve ou cria departamento
      let deptId: string | null = null
      if (r.department?.trim()) {
        const key = slug(r.department)
        if (deptMap.has(key)) {
          deptId = deptMap.get(key)!
        } else {
          const { data: nd } = await admin.from('departments').insert({ company_id: companyId, name: r.department.trim() }).select('id').single()
          if (nd) { deptId = nd.id; deptMap.set(key, nd.id) }
        }
      }

      // Resolve ou cria cargo
      let posId: string | null = null
      if (r.position?.trim()) {
        const key = slug(r.position)
        if (posMap.has(key)) {
          posId = posMap.get(key)!
        } else {
          const { data: np } = await admin.from('positions').insert({ company_id: companyId, title: r.position.trim() }).select('id').single()
          if (np) { posId = np.id; posMap.set(key, np.id) }
        }
      }

      const payload = {
        company_id:    companyId,
        full_name:     r.full_name.trim(),
        cpf:           r.cpf?.trim()        || null,
        email:         r.email?.trim()      || null,
        phone:         r.phone?.trim()      || null,
        birth_date:    r.birth_date?.trim() || null,
        hire_date:     r.hire_date?.trim()  || new Date().toISOString().slice(0, 10),
        department_id: deptId,
        position_id:   posId,
        salary:        r.salary ? Number(r.salary.replace(/[^0-9.]/g, '')) || null : null,
        status:        'active',
      }

      const { data: emp, error: empErr } = await admin.from('employees').insert(payload).select('id').single()
      if (empErr) {
        const msg = empErr.message.includes('duplicate') || empErr.message.includes('unique')
          ? 'CPF ou e-mail já cadastrado'
          : 'Erro ao inserir'
        errors.push({ row: rowNum, name: r.full_name, error: msg })
      } else {
        imported.push(emp.id)
      }
    }

    return NextResponse.json({ imported: imported.length, errors })
  } catch (err) {
    console.error('import-csv error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
