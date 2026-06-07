'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Building2, Clock, DollarSign,
  Palmtree, FileText, UserPlus, TrendingUp, BarChart3,
  Settings, ChevronLeft, ChevronRight,
  User, Timer, Receipt, FolderOpen, Briefcase,
  Gift, FileX, CalendarDays, Shield, PenLine, Network, Megaphone, DatabaseZap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '@/lib/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { useState } from 'react'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Users, Building2, Clock, DollarSign,
  Palmtree, FileText, UserPlus, TrendingUp, BarChart3, Settings,
  User, Timer, Receipt, FolderOpen, Briefcase,
  Gift, FileX, CalendarDays, Shield, PenLine, Network, Megaphone, DatabaseZap,
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
  const [collapsed, setCollapsed] = useState(false)

  const visibleItems = NAV_ITEMS.filter(
    (item) => user && item.roles.includes(user.role)
  )

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
          <span className="text-lg font-bold text-white">RH Control</span>
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
        {visibleItems.map((item) => {
          const Icon     = ICONS[item.icon]
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

          return (
            <div key={item.href}>
              {/* Divisor antes de seções */}
              {item.dividerBefore && !collapsed && (
                <div className="mx-3 my-3 border-t border-slate-700">
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-2 block">
                    Minha Área
                  </span>
                </div>
              )}
              {item.dividerBefore && collapsed && (
                <div className="mx-2 my-2 border-t border-slate-700" />
              )}
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                )}
              >
                {Icon && <Icon className="h-5 w-5 shrink-0" />}
                {!collapsed && <span>{item.label}</span>}
              </Link>
            </div>
          )
        })}
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
