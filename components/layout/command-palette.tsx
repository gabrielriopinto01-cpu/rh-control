'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Command, CommandDialog, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command'
import {
  LayoutDashboard, Users, Building2, Clock, DollarSign,
  Palmtree, FileText, UserPlus, TrendingUp, BarChart3,
  Settings, User, Timer, Receipt, FolderOpen, Briefcase,
  Gift, FileX, CalendarDays, Shield, PenLine, Network, Megaphone,
  MessageSquare, Bell, Stethoscope, UserMinus, Laptop, GraduationCap,
  Smile, ClipboardList, CalendarCheck, Sparkles, Star, BookMarked,
  BookOpen, Target, GitMerge, Printer,
} from 'lucide-react'
import { NAV_ITEMS } from '@/lib/constants/routes'
import { useAuth } from '@/hooks/use-auth'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Users, Building2, Clock, DollarSign,
  Palmtree, FileText, UserPlus, TrendingUp, BarChart3, Settings,
  User, Timer, Receipt, FolderOpen, Briefcase,
  Gift, FileX, CalendarDays, Shield, PenLine, Network, Megaphone,
  MessageSquare, Bell, Stethoscope, UserMinus, Laptop, GraduationCap,
  Smile, ClipboardList, CalendarCheck, Sparkles, Star, BookMarked,
  BookOpen, Target, GitMerge, Printer,
}

const GROUP_ORDER = [
  'Visão Geral', 'Pessoas', 'Departamento Pessoal',
  'Desenvolvimento', 'Comunicação', 'Inteligência',
  'Administração', 'Minha Área',
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const { user }  = useAuth()
  const router    = useRouter()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
        const active = document.activeElement?.tagName.toLowerCase()
        if (e.key === '/' && (active === 'input' || active === 'textarea')) return
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const navigate = useCallback((href: string) => {
    setOpen(false)
    router.push(href)
  }, [router])

  const items = NAV_ITEMS.filter(
    item => user && item.roles.includes(user.role) && item.href !== '/dev'
  )

  const groups = GROUP_ORDER.map(g => ({
    name: g,
    items: items.filter(i => i.group === g),
  })).filter(g => g.items.length > 0)

  return (
    <>
      {/* Trigger visível no header */}
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-2 text-sm text-gray-400 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1.5 transition-colors"
      >
        <span>Pesquisar...</span>
        <kbd className="ml-1 pointer-events-none inline-flex items-center gap-0.5 rounded border border-gray-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-500 font-medium">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Navegar para..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          {groups.map((group, gi) => (
            <div key={group.name}>
              {gi > 0 && <CommandSeparator />}
              <CommandGroup heading={group.name}>
                {group.items.map(item => {
                  const Icon = ICONS[item.icon]
                  return (
                    <CommandItem
                      key={item.href}
                      value={`${item.label} ${item.group}`}
                      onSelect={() => navigate(item.href)}
                      className="flex items-center gap-2"
                    >
                      {Icon && <Icon className="h-4 w-4 text-gray-500" />}
                      <span>{item.label}</span>
                      <span className="ml-auto text-xs text-gray-400">{item.group}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </div>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  )
}
