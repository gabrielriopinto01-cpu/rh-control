import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createInstance, getQrCode, connectionState, instanceName, isWhatsappConfigured } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function getCaller() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: me } = await admin.from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!me || !['adm_total', 'rh'].includes(me.role)) return null
  return me
}

// GET — estado atual da conexão da empresa
export async function GET() {
  if (!isWhatsappConfigured()) return NextResponse.json({ error: 'WhatsApp não configurado no servidor' }, { status: 503 })
  const me = await getCaller()
  if (!me) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { data: company } = await admin.from('companies').select('whatsapp_instance').eq('id', me.company_id).single()
  const instance = company?.whatsapp_instance
  if (!instance) return NextResponse.json({ connected: false, state: null })
  const state = await connectionState(instance)
  return NextResponse.json({ connected: state === 'open', state, instance })
}

// POST — cria/garante a instância e devolve o QR Code
export async function POST() {
  if (!isWhatsappConfigured()) return NextResponse.json({ error: 'WhatsApp não configurado no servidor' }, { status: 503 })
  const me = await getCaller()
  if (!me) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const instance = instanceName(me.company_id)
  // Salva a instância na empresa (idempotente)
  await admin.from('companies').update({ whatsapp_instance: instance }).eq('id', me.company_id)

  // Cria a instância na Evolution (ignora se já existir) e busca o QR
  await createInstance(instance)
  const qr = await getQrCode(instance)
  const state = await connectionState(instance)

  return NextResponse.json({ instance, qr, state, connected: state === 'open' })
}
