import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const isSupabaseConfigured = supabaseUrl?.startsWith('http') && !!supabaseKey

// ─── Rotas exclusivas por papel ──────────────────────────────────────────────

// Só estes papéis podem acessar (qualquer outro → /dashboard)
const RESTRICTED_TO: Record<string, string[]> = {
  '/payroll':       ['adm_total', 'rh'],
  '/reports':       ['adm_total', 'rh', 'gestor'],
  '/recruitment':   ['adm_total', 'rh'],
  '/departments':   ['adm_total', 'rh'],
  '/positions':     ['adm_total', 'rh'],
  '/settings':      ['adm_total', 'rh'],
  '/attendance':    ['adm_total', 'rh', 'gestor'],
  '/vacations':     ['adm_total', 'rh', 'gestor'],
  '/documents':     ['adm_total', 'rh', 'gestor'],
  '/performance':   ['adm_total', 'rh', 'gestor'],
  '/employees':     ['adm_total', 'rh', 'gestor'],
}

// Rotas exclusivas do colaborador (outros papéis → /dashboard)
const COLABORADOR_ONLY = [
  '/meu-ponto',
  '/meu-perfil',
  '/minhas-ferias',
  '/meus-holerites',
  '/meus-documentos',
  '/banco-horas',
]

export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password')

  // Não autenticado → login
  if (!user && !isAuthRoute && pathname !== '/offline') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Autenticado tentando acessar rota de auth → dashboard
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  if (user) {
    const role = request.cookies.get('rh_user_role')?.value ?? ''

    // Verifica restrições de papel (gestão)
    const restricted = Object.entries(RESTRICTED_TO).find(([prefix]) =>
      pathname.startsWith(prefix)
    )
    if (restricted) {
      const [, allowed] = restricted
      if (role && !allowed.includes(role)) {
        const url = request.nextUrl.clone()
        // Colaborador vai para sua área, gestor sem permissão vai para dashboard
        url.pathname = role === 'colaborador' ? '/meu-ponto' : '/dashboard'
        return NextResponse.redirect(url)
      }
    }

    // Bloqueia não-colaboradores de acessarem rotas exclusivas do colaborador
    const isColabRoute = COLABORADOR_ONLY.some(r => pathname.startsWith(r))
    if (isColabRoute && role && role !== 'colaborador') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Redireciona colaborador do /dashboard para /meu-ponto
    if (pathname === '/dashboard' && role === 'colaborador') {
      const url = request.nextUrl.clone()
      url.pathname = '/meu-ponto'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
