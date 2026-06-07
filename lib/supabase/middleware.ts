import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const isSupabaseConfigured = supabaseUrl?.startsWith('http') && !!supabaseKey

// Rotas restritas por papel: quais papéis podem acessar cada prefixo
const ROLE_RESTRICTIONS: Record<string, string[]> = {
  '/payroll':     ['adm_total', 'rh'],
  '/reports':     ['adm_total', 'rh'],
  '/recruitment': ['adm_total', 'rh', 'gestor'],
  '/performance': ['adm_total', 'rh', 'gestor'],
  '/departments': ['adm_total', 'rh'],
  '/settings':    ['adm_total', 'rh'],
}

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

  const isAuthRoute = pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password')

  // Não autenticado → login
  if (!user && !isAuthRoute) {
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

  // Verificação de papel para rotas restritas
  if (user) {
    const restricted = Object.entries(ROLE_RESTRICTIONS).find(([prefix]) =>
      pathname.startsWith(prefix)
    )
    if (restricted) {
      const [, allowedRoles] = restricted
      // Busca role do cookie (setado pelo AuthProvider no client)
      const roleCookie = request.cookies.get('rh_user_role')?.value
      if (roleCookie && !allowedRoles.includes(roleCookie)) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
