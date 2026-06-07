'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Clock, User, Palmtree, Receipt, FolderOpen, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'

const COLAB_NAV = [
  { label: 'Ponto',      href: '/meu-ponto',       icon: Clock },
  { label: 'Férias',     href: '/minhas-ferias',    icon: Palmtree },
  { label: 'Holerites',  href: '/meus-holerites',   icon: Receipt },
  { label: 'Documentos', href: '/meus-documentos',  icon: FolderOpen },
  { label: 'Banco',      href: '/banco-horas',       icon: Timer },
  { label: 'Perfil',     href: '/meu-perfil',       icon: User },
]

export function MobileNav() {
  const { user }   = useAuth()
  const pathname   = usePathname()

  if (user?.role !== 'colaborador') return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex sm:hidden safe-area-inset-bottom">
      {COLAB_NAV.map(({ label, href, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors',
              active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
            )}
          >
            <Icon className={cn('h-5 w-5', active && 'text-blue-600')} />
            <span className={cn('text-[10px] font-medium', active ? 'text-blue-600' : 'text-gray-400')}>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
