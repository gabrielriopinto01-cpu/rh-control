import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const { job_opening_id, name, email, phone, notes } = await req.json()
    if (!job_opening_id || !name || !email) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }

    // Verifica que a vaga existe e está aberta
    const { data: job } = await admin.from('job_openings').select('id, status').eq('id', job_opening_id).single()
    if (!job || job.status !== 'open') {
      return NextResponse.json({ error: 'Vaga não encontrada ou encerrada' }, { status: 404 })
    }

    // Evita duplicatas pelo mesmo e-mail
    const { data: existing } = await admin.from('candidates').select('id').eq('job_opening_id', job_opening_id).eq('email', email).single()
    if (existing) {
      return NextResponse.json({ error: 'Você já se candidatou a esta vaga' }, { status: 409 })
    }

    const { error } = await admin.from('candidates').insert({
      job_opening_id,
      name,
      email,
      phone: phone || null,
      notes: notes || null,
      stage: 'applied',
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    console.error('careers/apply error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
