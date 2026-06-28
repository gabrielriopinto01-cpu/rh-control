'use client'

import { useEffect, useState } from 'react'
import { Bell, LogOut, User } from 'lucide-react'
import { CommandPalette } from './command-palette'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/use-auth'
import { getInitials } from '@/lib/utils'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { computeAlerts, type Alert } from '@/lib/alerts'
import { useRouter } from 'next/navigation'

const ROLE_LABELS: Record<string, string> = {
  adm_total: 'ADM Total',
  rh: 'RH',
  gestor: 'Gestor',
  colaborador: 'Colaborador',
}

const SEV_DOT: Record<string, string> = {
  high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-blue-500',
}

export function Header() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Alert[]>([])

  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    const supabase = createClient()

    const refresh = () => {
      computeAlerts(supabase, user.company_id)
        .then(setNotifications)
        .catch(() => setNotifications([]))
    }

    refresh()

    // Realtime: atualiza sino quando chegam novas approval_requests ou vacations
    const channel = supabase
      .channel('header-alerts')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'approval_requests',
        filter: `company_id=eq.${user.company_id}`,
      }, refresh)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'vacations',
        filter: `company_id=eq.${user.company_id}`,
      }, refresh)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div />

      <div className="flex items-center gap-3">
        <CommandPalette />
        <DropdownMenu>
          <DropdownMenuTrigger className="relative inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-gray-100 transition-colors">
            <Bell className="h-5 w-5 text-gray-500" />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              Alertas
              {notifications.length > 0 && (
                <Badge variant="destructive" className="text-xs h-4 px-1.5">{notifications.length}</Badge>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400">Tudo em dia 🎉</div>
            ) : notifications.slice(0, 6).map(n => (
              <DropdownMenuItem key={n.id} className="flex items-start gap-3 py-3" onClick={() => router.push(n.href)}>
                <span className={`mt-1.5 shrink-0 h-2 w-2 rounded-full ${SEV_DOT[n.severity]}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{n.title}</p>
                  <p className="text-xs text-gray-400 truncate">{n.description}</p>
                </div>
              </DropdownMenuItem>
            ))}
            {notifications.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/alertas')} className="justify-center text-sm font-medium text-brand">
                  Ver todos os alertas
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 transition-colors outline-none">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.avatar_url ?? ''} />
              <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-semibold">
                {user ? getInitials(user.full_name) : '?'}
              </AvatarFallback>
            </Avatar>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-gray-800 leading-tight">
                {user?.full_name}
              </p>
              <Badge variant="secondary" className="text-xs h-4 px-1.5">
                {user ? ROLE_LABELS[user.role] : ''}
              </Badge>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <User className="h-4 w-4 mr-2" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
