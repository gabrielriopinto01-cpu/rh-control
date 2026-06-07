'use client'

import { useEffect, useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import type { Employee } from '@/types/database'

/**
 * Retorna o registro de Employee vinculado ao usuário logado.
 * Tenta primeiro por profile_id, depois por email como fallback.
 */
export function useMyEmployee() {
  const { user } = useAuth()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured() || !user) { setLoading(false); return }
    const supabase = createClient()

    async function load() {
      setLoading(true)
      // 1) tenta por profile_id
      let { data } = await supabase
        .from('employees')
        .select('*')
        .eq('company_id', user!.company_id)
        .eq('profile_id', user!.id)
        .maybeSingle()

      // 2) fallback: tenta por email
      if (!data && user!.email) {
        const res = await supabase
          .from('employees')
          .select('*')
          .eq('company_id', user!.company_id)
          .eq('email', user!.email)
          .maybeSingle()
        data = res.data
      }

      setEmployee(data ?? null)
      setLoading(false)
    }

    load()
  }, [user])

  return { employee, loading }
}
