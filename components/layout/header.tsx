'use client'

import { useEffect, useState } from 'react'
import { Bell, LogOut, User, Palmtree, FileWarning } from 'lucide-react'
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
import { useRouter } from 'next/navigation'

const ROLE_LABELS: Record<string, string> = {
  adm_total: 'ADM Total',
  rh: 'RH',
  gestor: 'Gestor',
  colaborador: 'Colaborador',
}

interface Notification {
  id: string
  icon: React.ReactNode
  message: string
  sub: string
}

export function Header() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return
    const supabase = createClient()
    const today   = new Date().toISOString().slice(0, 10)
    const in30    = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

    Promise.all([
      supabase.from('vacations').select('id, employee_id').eq('company_id', user.company_id).eq('status', 'pending'),
      supabase.from('documents').select('id, name, expires_at').eq('company_id', user.company_id)
        .gte('expires_at', today).lte('expires_at', in30),
    ]).then(([vacRes, docRes]) => {
      const notifs: Notification[] = []
      const vCount = (vacRes.data ?? []).length
      if (vCount > 0) notifs.push({
        id: 'vacations',
        icon: <Palmtree className="h-4 w-4 text-orange-500" />,
        message: `${vCount} solicitação${vCount > 1 ? 'ões' : ''} de férias pendente${vCount > 1 ? 's' : ''}`,
        sub: 'Aguardando aprovação',
      })
      const docs = docRes.data ?? []
      if (docs.length > 0) notifs.push({
        id: 'docs',
        icon: <FileWarning className="h-4 w-4 text-yellow-500" />,
        message: `${docs.length} documento${docs.length > 1 ? 's' : ''} vencendo em breve`,
        sub: 'Nos próximos 30 dias',
      })
      setNotifications(notifs)
    })
  }, [user])

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div />

      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="relative inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-gray-100 transition-colors">
            <Bell className="h-5 w-5 text-gray-500" />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel className="flex items-center justify-between">
              Notificações
              {notifications.length > 0 && (
                <Badge variant="destructive" className="text-xs h-4 px-1.5">{notifications.length}</Badge>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400">Nenhuma notificação</div>
            ) : notifications.map(n => (
              <DropdownMenuItem key={n.id} className="flex items-start gap-3 py-3 cursor-default">
                <div className="mt-0.5 shrink-0">{n.icon}</div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{n.message}</p>
                  <p className="text-xs text-gray-400">{n.sub}</p>
                </div>
              </DropdownMenuItem>
            ))}
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
