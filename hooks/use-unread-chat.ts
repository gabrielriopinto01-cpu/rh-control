'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

/** Conta o total de mensagens de chat não lidas do usuário atual. */
export function useUnreadChat(): number {
  const { user } = useAuth()
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) { setCount(0); return }
    const supabase = createClient()
    const { data: members } = await supabase
      .from('chat_thread_members')
      .select('thread_id, last_read_at')
      .eq('profile_id', user.id)
    const rows = members ?? []
    if (rows.length === 0) { setCount(0); return }
    const lastRead: Record<string, string | null> = {}
    for (const r of rows as any[]) lastRead[r.thread_id] = r.last_read_at
    const ids = rows.map((r: any) => r.thread_id)
    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('thread_id, sender_id, created_at')
      .in('thread_id', ids)
    let total = 0
    for (const m of (msgs ?? []) as any[]) {
      if (m.sender_id === user.id) continue
      const lr = lastRead[m.thread_id]
      if (!lr || m.created_at > lr) total++
    }
    setCount(total)
  }, [user])

  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    refresh()
    const supabase = createClient()
    const channel = supabase
      .channel('unread-chat')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `company_id=eq.${user.company_id}` },
        () => refresh())
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'chat_thread_members', filter: `profile_id=eq.${user.id}` },
        () => refresh())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, refresh])

  return count
}
