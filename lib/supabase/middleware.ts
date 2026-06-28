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
  '/employees':         ['adm_total', 'rh', 'gestor'],
  '/decimo-terceiro':   ['adm_total', 'rh'],
  '/rescisao':          ['adm_total', 'rh'],
  '/calendario':        ['adm_total', 'rh', 'gestor'],
  '/audit-log':         ['adm_total', 'rh'],
  '/onboarding':        ['adm_total', 'rh'],
  '/assinaturas':       ['adm_total', 'rh'],
  '/organograma':       ['adm_total', 'rh', 'gestor'],
  '/comunicados':       ['adm_total', 'rh'],
  '/atestados':         ['adm_total', 'rh', 'gestor'],
  '/afastamentos':      ['adm_total', 'rh'],
  '/equipamentos':      ['adm_total', 'rh', 'gestor'],
  '/treinamentos':      ['adm_total', 'rh', 'gestor'],
  '/alertas':           ['adm_total', 'rh', 'gestor'],
  '/checklists':        ['adm_total', 'rh'],
  '/fechamento-ponto':  ['adm_total', 'rh', 'gestor'],
  '/beneficios':        ['adm_total', 'rh'],
  '/okrs':              ['adm_total', 'rh', 'gestor'],
  '/pdi':               ['adm_total', 'rh', 'gestor'],
  '/espelho-ponto':     ['adm_total', 'rh', 'gestor'],
  '/workflows':         ['adm_total', 'rh', 'gestor'],
  '/ia':                ['adm_total', 'rh', 'gestor'],
}

// Rotas exclusivas do colaborador (outros papéis → /dashboard)
const COLABORADOR_ONLY = [
  '/meu-ponto',
  '/meu-perfil',
  '/minhas-ferias',
  '/meus-holerites',
  '/meus-documentos',
  '/banco-horas',
  '/meus-comunicados',
  '/meus-treinamentos',
  '/minha-avaliacao',
  '/meus-beneficios',
  '/meu-desenvolvimento',
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

  // Rotas públicas (sem login): crachá por QR, assinatura por token, e APIs
  // (as rotas /api validam autenticação/permissão internamente; webhooks precisam ser públicos)
  const isPublicRoute =
    pathname.startsWith('/api') ||
    pathname.startsWith('/cracha') ||
    pathname.startsWith('/sign') ||
    pathname.startsWith('/carreiras') ||
    pathname === '/offline' ||
    pathname === '/pricing'

  // Não autenticado → login
  if (!user && !isAuthRoute && !isPublicRoute) {
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
