'use client'

import { useEffect } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/store/auth-store'

function setRoleCookie(role: string) {
  document.cookie = `rh_user_role=${role}; path=/; max-age=86400; SameSite=Lax`
}

function clearRoleCookie() {
  document.cookie = 'rh_user_role=; path=/; max-age=0'
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore()

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false)
      return
    }

    const supabase = createClient()

    const loadUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        setUser(null)
        clearRoleCookie()
        setLoading(false)
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('*, companies(slug)')
        .eq('id', authUser.id)
        .single()

      if (profile) {
        setUser({
          id: authUser.id,
          email: authUser.email!,
          company_id: profile.company_id,
          company_slug: (profile.companies as { slug: string })?.slug ?? '',
          role: profile.role,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
        })
        setRoleCookie(profile.role)
      } else {
        clearRoleCookie()
      }
      setLoading(false)
    }

    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') clearRoleCookie()
      loadUser()
    })

    return () => subscription.unsubscribe()
  }, [setUser, setLoading])

  return <>{children}</>
}
