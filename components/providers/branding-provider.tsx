'use client'

import { useEffect } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuthStore } from '@/lib/store/auth-store'
import { useBrandingStore } from '@/lib/store/branding-store'
import { resolveBranding, applyBrandingVars, DEFAULT_BRANDING } from '@/lib/branding'

/**
 * Carrega o branding (White Label) da empresa do usuário logado e aplica
 * as cores como variáveis CSS, além de guardar nome/logo no store.
 */
export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const setBranding = useBrandingStore((s) => s.setBranding)

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) {
      applyBrandingVars(DEFAULT_BRANDING)
      return
    }
    const supabase = createClient()
    supabase
      .from('companies')
      .select('branding, logo_url')
      .eq('id', user.company_id)
      .single()
      .then(({ data }) => {
        const resolved = resolveBranding(data?.branding ?? null)
        applyBrandingVars(resolved)
        setBranding(resolved, data?.logo_url ?? null)
      })
  }, [user, setBranding])

  return <>{children}</>
}
