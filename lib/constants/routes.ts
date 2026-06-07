import type { UserRole } from '@/types/database'

export interface NavItem {
  label: string
  href: string
  icon: string
  roles: UserRole[]
  dividerBefore?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  // ─── Visão Geral ────────────────────────────────────────
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: 'LayoutDashboard',
    roles: ['adm_total', 'rh', 'gestor', 'colaborador'],
  },

  // ─── Gestão RH (adm/rh/gestor) ──────────────────────────
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
    label: 'Cargos',
    href: '/positions',
    icon: 'Briefcase',
    roles: ['adm_total', 'rh'],
  },
  {
    label: 'Ponto / Frequência',
    href: '/attendance',
    icon: 'Clock',
    roles: ['adm_total', 'rh', 'gestor'],
  },
  {
    label: 'Folha de Pagamento',
    href: '/payroll',
    icon: 'DollarSign',
    roles: ['adm_total', 'rh'],
  },
  {
    label: 'Férias',
    href: '/vacations',
    icon: 'Palmtree',
    roles: ['adm_total', 'rh', 'gestor'],
  },
  {
    label: 'Documentos',
    href: '/documents',
    icon: 'FileText',
    roles: ['adm_total', 'rh', 'gestor'],
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
    roles: ['adm_total', 'rh', 'gestor'],
  },
  {
    label: 'Relatórios',
    href: '/reports',
    icon: 'BarChart3',
    roles: ['adm_total', 'rh', 'gestor'],
  },
  {
    label: '13º Salário',
    href: '/decimo-terceiro',
    icon: 'Gift',
    roles: ['adm_total', 'rh'],
  },
  {
    label: 'Rescisão',
    href: '/rescisao',
    icon: 'FileX',
    roles: ['adm_total', 'rh'],
  },
  {
    label: 'Calendário',
    href: '/calendario',
    icon: 'CalendarDays',
    roles: ['adm_total', 'rh', 'gestor'],
  },
  {
    label: 'Log de Auditoria',
    href: '/audit-log',
    icon: 'Shield',
    roles: ['adm_total', 'rh'],
  },
  {
    label: 'Configurações',
    href: '/settings',
    icon: 'Settings',
    roles: ['adm_total', 'rh'],
  },

  // ─── Área do Colaborador ─────────────────────────────────
  {
    label: 'Meu Perfil',
    href: '/meu-perfil',
    icon: 'User',
    roles: ['colaborador'],
    dividerBefore: true,
  },
  {
    label: 'Meu Ponto',
    href: '/meu-ponto',
    icon: 'Clock',
    roles: ['colaborador'],
  },
  {
    label: 'Banco de Horas',
    href: '/banco-horas',
    icon: 'Timer',
    roles: ['colaborador'],
  },
  {
    label: 'Minhas Férias',
    href: '/minhas-ferias',
    icon: 'Palmtree',
    roles: ['colaborador'],
  },
  {
    label: 'Meus Holerites',
    href: '/meus-holerites',
    icon: 'Receipt',
    roles: ['colaborador'],
  },
  {
    label: 'Meus Documentos',
    href: '/meus-documentos',
    icon: 'FolderOpen',
    roles: ['colaborador'],
  },
]
