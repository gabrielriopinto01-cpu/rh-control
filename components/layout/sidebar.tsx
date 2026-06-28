'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Building2, Clock, DollarSign,
  Palmtree, FileText, UserPlus, TrendingUp, BarChart3,
  Settings, ChevronLeft, ChevronRight,
  User, Timer, Receipt, FolderOpen, Briefcase,
  Gift, FileX, CalendarDays, Shield, PenLine, Network, Megaphone, DatabaseZap,
  MessageSquare, Bell, Stethoscope, UserMinus, Laptop, GraduationCap, Smile, ClipboardList, CalendarCheck, Sparkles, Star,
  BookMarked, BookOpen, Target, GitMerge, Printer, AlertTriangle, ScrollText, FileCheck,
  Layers, FileUser,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '@/lib/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { useUnreadChat } from '@/hooks/use-unread-chat'
import { usePendingApprovals } from '@/hooks/use-pending-approvals'
import { useBrandingStore } from '@/lib/store/branding-store'
import { useState } from 'react'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Users, Building2, Clock, DollarSign,
  Palmtree, FileText, UserPlus, TrendingUp, BarChart3, Settings,
  User, Timer, Receipt, FolderOpen, Briefcase,
  Gift, FileX, CalendarDays, Shield, PenLine, Network, Megaphone, DatabaseZap,
  MessageSquare, Bell, Stethoscope, UserMinus, Laptop, GraduationCap, Smile, ClipboardList, CalendarCheck, Sparkles, Star,
  BookMarked, BookOpen, Target, GitMerge, Printer, AlertTriangle, ScrollText, FileCheck,
  Layers, FileUser,
}

const ROLE_LABELS: Record<string, string> = {
  adm_total:   'Administrador',
  rh:          'RH',
  gestor:      'Gestor',
  colaborador: 'Colaborador',
}

export function Sidebar() {
  const pathname = usePathname()
  const { user } = useAuth()
  const { branding, logoUrl } = useBrandingStore()
  const unreadChat       = useUnreadChat()
  const pendingApprovals = usePendingApprovals()
  const [collapsed, setCollapsed] = useState(false)

  const visibleItems = NAV_ITEMS.filter(
    (item) => user && item.roles.includes(user.role)
  )

  // Agrupa por seção preservando a ordem de aparição
  const groups: { name: string; items: typeof visibleItems }[] = []
  for (const item of visibleItems) {
    let g = groups.find((x) => x.name === item.group)
    if (!g) { g = { name: item.group, items: [] }; groups.push(g) }
    g.items.push(item)
  }

  return (
    <aside
      className={cn(
        'flex flex-col bg-slate-900 text-slate-100 transition-all duration-300 min-h-screen',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700">
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            {logoUrl && (
              <img src={logoUrl} alt="" className="h-8 w-8 rounded-md object-cover shrink-0" />
            )}
            <span className="text-lg font-bold text-white truncate">{branding.system_name}</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-slate-700 transition-colors ml-auto"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
        {groups.map((group, gi) => (
          <div key={group.name} className={gi > 0 ? 'mt-4' : ''}>
            {/* Cabeçalho da seção */}
            {!collapsed ? (
              <p className="px-3 mb-1 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                {group.name}
              </p>
            ) : gi > 0 ? (
              <div className="mx-2 mb-2 border-t border-slate-700" />
            ) : null}

            {group.items.map((item) => {
              const Icon     = ICONS[item.icon]
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  style={isActive ? { backgroundColor: 'var(--brand)' } : undefined}
                  className={cn(
                    'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  {Icon && <Icon className="h-5 w-5 shrink-0" />}
                  {!collapsed && <span className="flex-1">{item.label}</span>}
                  {item.href === '/chat' && unreadChat > 0 && (
                    <span className={cn(
                      'min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center',
                      collapsed && 'absolute top-1 right-1 min-w-4 h-4 px-1 text-[10px]'
                    )}>
                      {unreadChat > 9 ? '9+' : unreadChat}
                    </span>
                  )}
                  {item.href === '/workflows' && pendingApprovals > 0 && (
                    <span className={cn(
                      'min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center',
                      collapsed && 'absolute top-1 right-1 min-w-4 h-4 px-1 text-[10px]'
                    )}>
                      {pendingApprovals > 9 ? '9+' : pendingApprovals}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User info */}
      {!collapsed && user && (
        <div className="p-4 border-t border-slate-700">
          <p className="text-xs text-slate-300 font-medium truncate">{user.full_name}</p>
          <p className="text-xs text-slate-500 truncate">{ROLE_LABELS[user.role] ?? user.role}</p>
        </div>
      )}
    </aside>
  )
}
