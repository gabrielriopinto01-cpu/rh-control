import type { UserRole } from '@/types/database'

export interface NavItem {
  label: string
  href: string
  icon: string
  roles: UserRole[]
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: 'LayoutDashboard',
    roles: ['adm_total', 'rh', 'gestor', 'colaborador'],
  },
  {
    label: 'Colaboradores',
    href: '/employees',
    icon: 'Users',
    roles: ['adm_total', 'rh', 'gestor'],
  },
  {
    label: 'Departamentos',
    href: '/departments',
    icon: 'Building2',
    roles: ['adm_total', 'rh'],
  },
  {
    label: 'Ponto / Frequência',
    href: '/attendance',
    icon: 'Clock',
    roles: ['adm_total', 'rh', 'gestor', 'colaborador'],
  },
  {
    label: 'Folha de Pagamento',
    href: '/payroll',
    icon: 'DollarSign',
    roles: ['adm_total', 'rh', 'gestor', 'colaborador'],
  },
  {
    label: 'Férias',
    href: '/vacations',
    icon: 'Palmtree',
    roles: ['adm_total', 'rh', 'gestor', 'colaborador'],
  },
  {
    label: 'Documentos',
    href: '/documents',
    icon: 'FileText',
    roles: ['adm_total', 'rh', 'gestor', 'colaborador'],
  },
  {
    label: 'Recrutamento',
    href: '/recruitment',
    icon: 'UserPlus',
    roles: ['adm_total', 'rh'],
  },
  {
    label: 'Desempenho',
    href: '/performance',
    icon: 'TrendingUp',
    roles: ['adm_total', 'rh', 'gestor', 'colaborador'],
  },
  {
    label: 'Relatórios',
    href: '/reports',
    icon: 'BarChart3',
    roles: ['adm_total', 'rh', 'gestor'],
  },
  {
    label: 'Configurações',
    href: '/settings',
    icon: 'Settings',
    roles: ['adm_total', 'rh'],
  },
]
