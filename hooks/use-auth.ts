'use client'

import { useAuthStore } from '@/lib/store/auth-store'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function useAuth() {
  const { user, loading } = useAuthStore()
  const router = useRouter()

  const signOut = async () => {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return { user, loading, signOut }
}
