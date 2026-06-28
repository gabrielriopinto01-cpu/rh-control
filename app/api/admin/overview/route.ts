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
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    // Só admins de plataforma
    const { data: pa } = await admin.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle()
    if (!pa) return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })

    const [companiesRes, profilesRes, employeesRes] = await Promise.all([
      admin.from('companies').select('id, name, plan, status, created_at').order('created_at', { ascending: false }),
      admin.from('profiles').select('company_id'),
      admin.from('employees').select('company_id, status'),
    ])

    const companies = companiesRes.data ?? []
    const profiles  = profilesRes.data ?? []
    const employees = employeesRes.data ?? []

    const usersByCompany: Record<string, number> = {}
    for (const p of profiles) usersByCompany[p.company_id] = (usersByCompany[p.company_id] ?? 0) + 1
    const empByCompany: Record<string, number> = {}
    for (const e of employees) if (e.status === 'active') empByCompany[e.company_id] = (empByCompany[e.company_id] ?? 0) + 1

    const list = companies.map(c => ({
      id: c.id, name: c.name, plan: c.plan, status: c.status, created_at: c.created_at,
      users: usersByCompany[c.id] ?? 0, employees: empByCompany[c.id] ?? 0,
    }))

    const totals = {
      companies: companies.length,
      active:    companies.filter(c => c.status === 'active').length,
      blocked:   companies.filter(c => c.status !== 'active').length,
      users:     profiles.length,
      employees: employees.filter(e => e.status === 'active').length,
      paid:      companies.filter(c => c.plan && c.plan !== 'free').length,
    }

    return NextResponse.json({ totals, companies: list })
  } catch (err) {
    console.error('admin overview error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
