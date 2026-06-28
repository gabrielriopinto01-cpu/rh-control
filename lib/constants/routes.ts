import type { UserRole } from '@/types/database'

export interface NavItem {
  label: string
  href: string
  icon: string
  roles: UserRole[]
  group: string
  dividerBefore?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  // ─── Visão Geral ────────────────────────────────────────
  { label: 'Dashboard',  href: '/dashboard',  icon: 'LayoutDashboard', group: 'Visão Geral', roles: ['adm_total', 'rh', 'gestor', 'colaborador'] },
  { label: 'Alertas',    href: '/alertas',    icon: 'Bell',            group: 'Visão Geral', roles: ['adm_total', 'rh', 'gestor'] },
  { label: 'Chat',       href: '/chat',       icon: 'MessageSquare',   group: 'Visão Geral', roles: ['adm_total', 'rh', 'gestor', 'colaborador'] },
  { label: 'Calendário', href: '/calendario', icon: 'CalendarDays',    group: 'Visão Geral', roles: ['adm_total', 'rh', 'gestor'] },

  // ─── Pessoas ────────────────────────────────────────────
  { label: 'Colaboradores',         href: '/employees',    icon: 'Users',        group: 'Pessoas', roles: ['adm_total', 'rh', 'gestor'] },
  { label: 'Departamentos',         href: '/departments',  icon: 'Building2',    group: 'Pessoas', roles: ['adm_total', 'rh'] },
  { label: 'Cargos',                href: '/cargos',       icon: 'Briefcase',    group: 'Pessoas', roles: ['adm_total', 'rh'] },
  { label: 'Organograma',           href: '/organograma',  icon: 'Network',      group: 'Pessoas', roles: ['adm_total', 'rh', 'gestor'] },
  { label: 'Recrutamento',          href: '/recruitment',  icon: 'UserPlus',     group: 'Pessoas', roles: ['adm_total', 'rh'] },
  { label: 'Admissão/Desligamento', href: '/checklists',   icon: 'ClipboardList',group: 'Pessoas', roles: ['adm_total', 'rh'] },
  { label: 'Benefícios',            href: '/beneficios',   icon: 'Gift',          group: 'Pessoas', roles: ['adm_total', 'rh'] },
  { label: 'Equipamentos',          href: '/equipamentos', icon: 'Laptop',       group: 'Pessoas', roles: ['adm_total', 'rh', 'gestor'] },

  // ─── Departamento Pessoal ───────────────────────────────
  { label: 'Ponto / Frequência', href: '/attendance',       icon: 'Clock',        group: 'Departamento Pessoal', roles: ['adm_total', 'rh', 'gestor'] },
  { label: 'Fechamento de Ponto',href: '/fechamento-ponto', icon: 'CalendarCheck',group: 'Departamento Pessoal', roles: ['adm_total', 'rh', 'gestor'] },
  { label: 'Espelho de Ponto',  href: '/espelho-ponto',   icon: 'Printer',       group: 'Departamento Pessoal', roles: ['adm_total', 'rh', 'gestor'] },
  { label: 'Folha de Pagamento', href: '/payroll',          icon: 'DollarSign',   group: 'Departamento Pessoal', roles: ['adm_total', 'rh'] },
  { label: 'Holerite Individual',href: '/holerite-individual', icon: 'Receipt',    group: 'Departamento Pessoal', roles: ['adm_total', 'rh'] },
  { label: 'Férias',             href: '/vacations',        icon: 'Palmtree',     group: 'Departamento Pessoal', roles: ['adm_total', 'rh', 'gestor'] },
  { label: 'Atestados',          href: '/atestados',        icon: 'Stethoscope',  group: 'Departamento Pessoal', roles: ['adm_total', 'rh', 'gestor'] },
  { label: 'Afastamentos',       href: '/afastamentos',     icon: 'UserMinus',    group: 'Departamento Pessoal', roles: ['adm_total', 'rh'] },
  { label: '13º Salário',        href: '/decimo-terceiro',  icon: 'Gift',         group: 'Departamento Pessoal', roles: ['adm_total', 'rh'] },
  { label: 'Rescisão',           href: '/rescisao',         icon: 'FileX',        group: 'Departamento Pessoal', roles: ['adm_total', 'rh'] },
  { label: 'Advertências',       href: '/advertencias',     icon: 'AlertTriangle', group: 'Departamento Pessoal', roles: ['adm_total', 'rh'] },
  { label: 'Contrato de Admissão',href: '/contrato-admissao', icon: 'ScrollText',   group: 'Departamento Pessoal', roles: ['adm_total', 'rh'] },
  { label: 'Documentos',         href: '/documents',        icon: 'FileText',     group: 'Departamento Pessoal', roles: ['adm_total', 'rh', 'gestor'] },

  // ─── Desenvolvimento ────────────────────────────────────
  { label: 'Treinamentos', href: '/treinamentos', icon: 'GraduationCap', group: 'Desenvolvimento', roles: ['adm_total', 'rh', 'gestor'] },
  { label: 'Desempenho',   href: '/performance',  icon: 'TrendingUp',    group: 'Desenvolvimento', roles: ['adm_total', 'rh', 'gestor'] },
  { label: 'OKRs',         href: '/okrs',         icon: 'Target',        group: 'Desenvolvimento', roles: ['adm_total', 'rh', 'gestor'] },
  { label: 'PDI',          href: '/pdi',          icon: 'BookOpen',      group: 'Desenvolvimento', roles: ['adm_total', 'rh', 'gestor'] },
  { label: 'Clima',        href: '/clima',        icon: 'Smile',         group: 'Desenvolvimento', roles: ['adm_total', 'rh', 'gestor', 'colaborador'] },

  // ─── Comunicação ────────────────────────────────────────
  { label: 'Comunicados', href: '/comunicados', icon: 'Megaphone', group: 'Comunicação', roles: ['adm_total', 'rh'] },

  // ─── Inteligência ───────────────────────────────────────
  { label: 'Workflows',     href: '/workflows', icon: 'GitMerge', group: 'Administração', roles: ['adm_total', 'rh', 'gestor'] },
  { label: 'Relatórios',       href: '/reports',     icon: 'BarChart3',  group: 'Inteligência', roles: ['adm_total', 'rh', 'gestor'] },
  { label: 'Centro de Conhecimento', href: '/conhecimento', icon: 'BookMarked', group: 'Inteligência', roles: ['adm_total', 'rh', 'gestor', 'colaborador'] },
  { label: 'Assistente IA', href: '/ia',      icon: 'Sparkles',  group: 'Inteligência', roles: ['adm_total', 'rh', 'gestor'] },

  // ─── Administração ──────────────────────────────────────
  { label: 'Assinaturas',     href: '/assinaturas', icon: 'PenLine',     group: 'Administração', roles: ['adm_total', 'rh'] },
  { label: 'Log de Auditoria',href: '/audit-log',   icon: 'Shield',      group: 'Administração', roles: ['adm_total', 'rh'] },
  { label: 'Configurações',   href: '/settings',    icon: 'Settings',    group: 'Administração', roles: ['adm_total', 'rh'] },
  { label: 'Dev / Seed',      href: '/dev',         icon: 'DatabaseZap', group: 'Administração', roles: ['adm_total'] },

  // ─── Área do Colaborador ─────────────────────────────────
  { label: 'Meu Perfil',     href: '/meu-perfil',       icon: 'User',          group: 'Minha Área', roles: ['colaborador'] },
  { label: 'Meu Ponto',      href: '/meu-ponto',        icon: 'Clock',         group: 'Minha Área', roles: ['colaborador'] },
  { label: 'Banco de Horas', href: '/banco-horas',      icon: 'Timer',         group: 'Minha Área', roles: ['colaborador'] },
  { label: 'Minhas Férias',  href: '/minhas-ferias',    icon: 'Palmtree',      group: 'Minha Área', roles: ['colaborador'] },
  { label: 'Meus Holerites', href: '/meus-holerites',   icon: 'Receipt',       group: 'Minha Área', roles: ['colaborador'] },
  { label: 'Meus Documentos',href: '/meus-documentos',  icon: 'FolderOpen',    group: 'Minha Área', roles: ['colaborador'] },
  { label: 'Comunicados',    href: '/meus-comunicados', icon: 'Megaphone',     group: 'Minha Área', roles: ['colaborador'] },
  { label: 'Treinamentos',   href: '/meus-treinamentos',icon: 'GraduationCap', group: 'Minha Área', roles: ['colaborador'] },
  { label: 'Minha Avaliação',    href: '/minha-avaliacao',   icon: 'Star',        group: 'Minha Área', roles: ['colaborador'] },
  { label: 'Meu Desenvolvimento',href: '/meu-desenvolvimento',icon: 'TrendingUp', group: 'Minha Área', roles: ['colaborador'] },
  { label: 'Meus Benefícios',    href: '/meus-beneficios',   icon: 'Gift',        group: 'Minha Área', roles: ['colaborador'] },
]
