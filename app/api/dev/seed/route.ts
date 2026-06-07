import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─── Dados demo ──────────────────────────────────────────────────────────────

const DEPARTMENTS = [
  { name: 'Recursos Humanos' },
  { name: 'Tecnologia da Informação' },
  { name: 'Financeiro' },
  { name: 'Operações' },
  { name: 'Comercial' },
]

const POSITIONS = [
  { title: 'Analista de RH',           dept: 'Recursos Humanos',          salary_min: 3500,  salary_max: 6000,  cbo_code: '2521-05' },
  { title: 'Assistente de RH',         dept: 'Recursos Humanos',          salary_min: 2000,  salary_max: 3500,  cbo_code: '4141-05' },
  { title: 'Desenvolvedor Full Stack',  dept: 'Tecnologia da Informação',  salary_min: 6000,  salary_max: 12000, cbo_code: '2124-05' },
  { title: 'Gerente de TI',            dept: 'Tecnologia da Informação',  salary_min: 10000, salary_max: 18000, cbo_code: '1425-05' },
  { title: 'Analista de Suporte',      dept: 'Tecnologia da Informação',  salary_min: 3000,  salary_max: 5500,  cbo_code: '3172-05' },
  { title: 'Analista Financeiro',      dept: 'Financeiro',                salary_min: 4000,  salary_max: 7000,  cbo_code: '2523-05' },
  { title: 'Assistente Financeiro',    dept: 'Financeiro',                salary_min: 2200,  salary_max: 3800,  cbo_code: '4131-05' },
  { title: 'Analista de Operações',    dept: 'Operações',                 salary_min: 3500,  salary_max: 6500,  cbo_code: '3141-05' },
  { title: 'Consultor Comercial',      dept: 'Comercial',                 salary_min: 3000,  salary_max: 8000,  cbo_code: '3541-05' },
  { title: 'Gerente Comercial',        dept: 'Comercial',                 salary_min: 8000,  salary_max: 15000, cbo_code: '1414-05' },
]

type EmpTemplate = {
  full_name: string; cpf: string; rg: string; email: string; phone: string
  birth_date: string; hire_date: string; salary: number
  dept: string; position: string; contract_type: string; status: string
  bank: string; agency: string; account: string; account_type: string
  cep: string; street: string; number: string; neighborhood: string; city: string; state: string
}

const EMPLOYEES: EmpTemplate[] = [
  {
    full_name: 'Mariana Costa Silva',    cpf: '52998224725', rg: '234567890',
    email: 'mariana.costa@empresa.com',  phone: '(11) 99111-2233',
    birth_date: '1992-08-14',           hire_date: '2022-03-15',
    salary: 4800,                        dept: 'Recursos Humanos',
    position: 'Analista de RH',          contract_type: 'clt', status: 'active',
    bank: 'Itaú',  agency: '0341', account: '12345-6', account_type: 'corrente',
    cep: '01310-100', street: 'Av. Paulista', number: '1000', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP',
  },
  {
    full_name: 'Rafael Oliveira Souza',  cpf: '87748248800', rg: '345678901',
    email: 'rafael.oliveira@empresa.com', phone: '(11) 98222-3344',
    birth_date: '1990-03-22',            hire_date: '2021-06-01',
    salary: 9200,                         dept: 'Tecnologia da Informação',
    position: 'Desenvolvedor Full Stack', contract_type: 'clt', status: 'active',
    bank: 'Bradesco', agency: '1234', account: '56789-0', account_type: 'corrente',
    cep: '04538-133', street: 'Av. Brigadeiro Faria Lima', number: '3729', neighborhood: 'Itaim Bibi', city: 'São Paulo', state: 'SP',
  },
  {
    full_name: 'Juliana Ferreira Lima',  cpf: '71428793860', rg: '456789012',
    email: 'juliana.lima@empresa.com',   phone: '(11) 97333-4455',
    birth_date: '1985-11-30',            hire_date: '2020-01-10',
    salary: 14500,                        dept: 'Tecnologia da Informação',
    position: 'Gerente de TI',           contract_type: 'clt', status: 'active',
    bank: 'Santander', agency: '0007', account: '11111-1', account_type: 'corrente',
    cep: '01452-001', street: 'Rua Funchal', number: '418', neighborhood: 'Vila Olímpia', city: 'São Paulo', state: 'SP',
  },
  {
    full_name: 'Pedro Almeida Martins',  cpf: '11222333001', rg: '567890123',
    email: 'pedro.almeida@empresa.com',  phone: '(11) 96444-5566',
    birth_date: '1995-06-18',            hire_date: '2023-02-20',
    salary: 7500,                         dept: 'Tecnologia da Informação',
    position: 'Desenvolvedor Full Stack', contract_type: 'clt', status: 'active',
    bank: 'Nubank', agency: '0001', account: '22222-2', account_type: 'corrente',
    cep: '03002-000', street: 'Rua da Consolação', number: '222', neighborhood: 'Consolação', city: 'São Paulo', state: 'SP',
  },
  {
    full_name: 'Fernanda Santos Rocha',  cpf: '22233344402', rg: '678901234',
    email: 'fernanda.santos@empresa.com', phone: '(11) 95555-6677',
    birth_date: '1994-01-07',            hire_date: '2022-09-05',
    salary: 3400,                         dept: 'Financeiro',
    position: 'Assistente Financeiro',   contract_type: 'clt', status: 'active',
    bank: 'Caixa', agency: '0234', account: '33333-3', account_type: 'poupanca',
    cep: '02021-000', street: 'Rua Voluntários da Pátria', number: '1500', neighborhood: 'Santana', city: 'São Paulo', state: 'SP',
  },
  {
    full_name: 'Carlos Mendes Barbosa',  cpf: '33344455503', rg: '789012345',
    email: 'carlos.mendes@empresa.com',  phone: '(11) 94666-7788',
    birth_date: '1988-09-25',            hire_date: '2021-11-15',
    salary: 5200,                         dept: 'Financeiro',
    position: 'Analista Financeiro',     contract_type: 'clt', status: 'active',
    bank: 'Banco do Brasil', agency: '9999', account: '44444-4', account_type: 'corrente',
    cep: '05307-000', street: 'Av. Rebouças', number: '3500', neighborhood: 'Pinheiros', city: 'São Paulo', state: 'SP',
  },
  {
    full_name: 'Ana Paula Rodrigues',    cpf: '44455566604', rg: '890123456',
    email: 'ana.rodrigues@empresa.com',  phone: '(11) 93777-8899',
    birth_date: '1991-04-12',            hire_date: '2023-07-10',
    salary: 4200,                         dept: 'Operações',
    position: 'Analista de Operações',   contract_type: 'clt', status: 'active',
    bank: 'Inter', agency: '0001', account: '55555-5', account_type: 'corrente',
    cep: '04043-001', street: 'Rua Domingos de Moraes', number: '800', neighborhood: 'Vila Mariana', city: 'São Paulo', state: 'SP',
  },
  {
    full_name: 'Lucas Pereira Gomes',    cpf: '55566677705', rg: '901234567',
    email: 'lucas.pereira@empresa.com',  phone: '(11) 92888-9900',
    birth_date: '1997-12-03',            hire_date: '2024-01-08',
    salary: 6800,                         dept: 'Comercial',
    position: 'Consultor Comercial',     contract_type: 'clt', status: 'active',
    bank: 'C6 Bank', agency: '0001', account: '66666-6', account_type: 'corrente',
    cep: '01310-200', street: 'Av. Paulista', number: '2000', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP',
  },
  {
    full_name: 'Beatriz Carvalho Dias',  cpf: '66677788806', rg: '012345678',
    email: 'beatriz.carvalho@empresa.com', phone: '(11) 91999-0011',
    birth_date: '1989-07-19',             hire_date: '2019-05-20',
    salary: 12000,                          dept: 'Comercial',
    position: 'Gerente Comercial',         contract_type: 'clt', status: 'active',
    bank: 'Itaú', agency: '0341', account: '77777-7', account_type: 'corrente',
    cep: '01422-001', street: 'Rua Augusta', number: '400', neighborhood: 'Cerqueira César', city: 'São Paulo', state: 'SP',
  },
  {
    full_name: 'Thiago Nunes Costa',     cpf: '77788899907', rg: '123456789',
    email: 'thiago.nunes@empresa.com',   phone: '(11) 90000-1122',
    birth_date: '1993-02-28',            hire_date: '2020-08-03',
    salary: 3800,                         dept: 'Tecnologia da Informação',
    position: 'Analista de Suporte',     contract_type: 'clt', status: 'on_leave',
    bank: 'Bradesco', agency: '5678', account: '88888-8', account_type: 'corrente',
    cep: '02052-011', street: 'Rua do Triunfo', number: '50', neighborhood: 'Santa Cecília', city: 'São Paulo', state: 'SP',
  },
  {
    full_name: 'Camila Teixeira Nobre',  cpf: '88899900008', rg: '234567891',
    email: 'camila.teixeira@empresa.com', phone: '(11) 89111-2233',
    birth_date: '1996-10-15',             hire_date: '2021-03-22',
    salary: 2800,                          dept: 'Recursos Humanos',
    position: 'Assistente de RH',         contract_type: 'clt', status: 'active',
    bank: 'Nubank', agency: '0001', account: '99999-9', account_type: 'corrente',
    cep: '01310-300', street: 'Av. Paulista', number: '3000', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP',
  },
  {
    full_name: 'Diego Alves Moreira',    cpf: '99900011109', rg: '345678902',
    email: 'diego.alves@empresa.com',    phone: '(11) 88222-3344',
    birth_date: '1987-05-08',            hire_date: '2018-11-01',
    salary: 8800,                         dept: 'Comercial',
    position: 'Consultor Comercial',     contract_type: 'pj', status: 'active',
    bank: 'Inter', agency: '0001', account: '10101-0', account_type: 'corrente',
    cep: '04581-001', street: 'Av. das Nações Unidas', number: '12901', neighborhood: 'Berrini', city: 'São Paulo', state: 'SP',
  },
]

export async function POST(req: NextRequest) {
  try {
    // Verifica autenticação via header Authorization (Bearer token do Supabase)
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { company_id } = await req.json()
    if (!company_id) {
      return NextResponse.json({ error: 'company_id obrigatório' }, { status: 400 })
    }

    // Verifica se empresa existe
    const { data: company } = await supabaseAdmin.from('companies').select('id').eq('id', company_id).single()
    if (!company) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })

    // Verifica se já tem dados (evita duplicar)
    const { count } = await supabaseAdmin
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', company_id)
    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: 'Esta empresa já possui colaboradores. Limpe os dados antes de popular novamente.' }, { status: 409 })
    }

    const log: string[] = []

    // ── 1. Departamentos ──────────────────────────────────────────────────────
    const { data: depts, error: deptErr } = await supabaseAdmin
      .from('departments')
      .insert(DEPARTMENTS.map(d => ({ ...d, company_id })))
      .select()
    if (deptErr || !depts) throw new Error(`Departamentos: ${deptErr?.message}`)
    log.push(`✅ ${depts.length} departamentos criados`)

    const deptMap = Object.fromEntries(depts.map(d => [d.name, d.id]))

    // ── 2. Cargos ─────────────────────────────────────────────────────────────
    const { data: positions, error: posErr } = await supabaseAdmin
      .from('positions')
      .insert(POSITIONS.map(p => ({
        company_id,
        title:         p.title,
        department_id: deptMap[p.dept] ?? null,
        salary_min:    p.salary_min,
        salary_max:    p.salary_max,
        cbo_code:      p.cbo_code,
      })))
      .select()
    if (posErr || !positions) throw new Error(`Cargos: ${posErr?.message}`)
    log.push(`✅ ${positions.length} cargos criados`)

    const posMap = Object.fromEntries(positions.map(p => [p.title, p.id]))

    // ── 3. Colaboradores ──────────────────────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10)
    const { data: employees, error: empErr } = await supabaseAdmin
      .from('employees')
      .insert(EMPLOYEES.map((e, i) => ({
        company_id,
        employee_code:  `EMP${String(i + 1).padStart(3, '0')}`,
        full_name:      e.full_name,
        cpf:            e.cpf,
        rg:             e.rg,
        email:          e.email,
        phone:          e.phone,
        birth_date:     e.birth_date,
        hire_date:      e.hire_date,
        salary:         e.salary,
        department_id:  deptMap[e.dept] ?? null,
        position_id:    posMap[e.position] ?? null,
        contract_type:  e.contract_type,
        status:         e.status,
        bank_details: {
          bank:         e.bank,
          agency:       e.agency,
          account:      e.account,
          account_type: e.account_type,
          pix_key:      null,
        },
        address: {
          cep:          e.cep,
          street:       e.street,
          number:       e.number,
          complement:   null,
          neighborhood: e.neighborhood,
          city:         e.city,
          state:        e.state,
        },
      })))
      .select()
    if (empErr || !employees) throw new Error(`Colaboradores: ${empErr?.message}`)
    log.push(`✅ ${employees.length} colaboradores criados`)

    // ── 4. Férias ─────────────────────────────────────────────────────────────
    const addDays = (base: string, n: number) => {
      const d = new Date(base); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10)
    }
    const vacations = [
      { employee_id: employees[0].id, start_date: addDays(today, 15), end_date: addDays(today, 44),  days: 30, status: 'approved', notes: 'Férias anuais aprovadas' },
      { employee_id: employees[1].id, start_date: addDays(today, -60), end_date: addDays(today, -31), days: 30, status: 'taken',    notes: 'Férias já usufruídas' },
      { employee_id: employees[4].id, start_date: addDays(today, 5),  end_date: addDays(today, 19),  days: 15, status: 'pending',  notes: 'Aguardando aprovação do gestor' },
      { employee_id: employees[5].id, start_date: addDays(today, 30), end_date: addDays(today, 59),  days: 30, status: 'approved', notes: 'Férias do segundo semestre' },
      { employee_id: employees[7].id, start_date: addDays(today, -15), end_date: addDays(today, -1),  days: 15, status: 'taken',   notes: 'Férias de meio do ano' },
      { employee_id: employees[8].id, start_date: addDays(today, 60), end_date: addDays(today, 89),  days: 30, status: 'pending',  notes: 'Férias programadas' },
    ]
    const { error: vacErr } = await supabaseAdmin
      .from('vacations')
      .insert(vacations.map(v => ({ ...v, company_id })))
    if (vacErr) throw new Error(`Férias: ${vacErr.message}`)
    log.push(`✅ ${vacations.length} solicitações de férias criadas`)

    // ── 5. Folha de pagamento ─────────────────────────────────────────────────
    const refMonth = today.slice(0, 7)
    const { data: payroll, error: payErr } = await supabaseAdmin
      .from('payrolls')
      .insert({
        company_id,
        reference_month: refMonth,
        status: 'closed',
        total_gross: employees.reduce((s, _, i) => s + EMPLOYEES[i].salary, 0),
        total_deductions: employees.reduce((s, _, i) => s + Math.round(EMPLOYEES[i].salary * 0.15), 0),
        total_net: employees.reduce((s, _, i) => s + Math.round(EMPLOYEES[i].salary * 0.85), 0),
        closed_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (!payErr && payroll) {
      const items = employees.map((emp, i) => {
        const gross = EMPLOYEES[i].salary
        const inss  = Math.round(gross * 0.09)
        const irrf  = Math.round(gross * 0.075)
        const fgts  = Math.round(gross * 0.08)
        return {
          payroll_id:       payroll.id,
          employee_id:      emp.id,
          gross_salary:     gross,
          inss,
          irrf,
          fgts,
          net_salary:       gross - inss - irrf,
          other_deductions: null,
          other_additions:  null,
        }
      })
      await supabaseAdmin.from('payroll_items').insert(items)
      log.push(`✅ Folha de ${refMonth} fechada com ${items.length} itens`)
    }

    return NextResponse.json({ success: true, log })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    console.error('Seed error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { company_id } = await req.json()
    if (!company_id) return NextResponse.json({ error: 'company_id obrigatório' }, { status: 400 })

    // Deleta na ordem certa (FK constraints)
    await supabaseAdmin.from('payroll_items').delete().in(
      'payroll_id',
      (await supabaseAdmin.from('payrolls').select('id').eq('company_id', company_id)).data?.map(p => p.id) ?? []
    )
    await supabaseAdmin.from('payrolls').delete().eq('company_id', company_id)
    await supabaseAdmin.from('vacations').delete().eq('company_id', company_id)
    await supabaseAdmin.from('employees').delete().eq('company_id', company_id)
    await supabaseAdmin.from('positions').delete().eq('company_id', company_id)
    await supabaseAdmin.from('departments').delete().eq('company_id', company_id)

    return NextResponse.json({ success: true, message: 'Dados limpos com sucesso' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
