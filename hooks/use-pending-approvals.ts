'use client'

import { useEffect, useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from './use-auth'

export function usePendingApprovals(): number {
  const { user } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    // Só gestores/rh/adm precisam ver aprovações pendentes
    if (user.role === 'colaborador') return

    const supabase = createClient()

    const fetch = async () => {
      const { count: c } = await supabase
        .from('approval_requests')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', user.company_id)
        .eq('status', 'pending')
      setCount(c ?? 0)
    }

    fetch()

    const channel = supabase
      .channel('pending-approvals-badge')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'approval_requests',
        filter: `company_id=eq.${user.company_id}`,
      }, fetch)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  return count
}
