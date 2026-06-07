import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const { password, email } = await req.json()
    if (!password || !email) {
      return NextResponse.json({ error: 'email e password obrigatorios' }, { status: 400 })
    }
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })
    const user = users.find(u => u.email === email)
    if (!user) return NextResponse.json({ error: 'Usuario nao encontrado' }, { status: 404 })
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email_confirm: true,
      password,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, message: `OK! Agora logue com ${email} e a nova senha.` })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}