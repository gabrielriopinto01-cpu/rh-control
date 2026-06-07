import type { UserRole } from '@/types/database'

export type Permission =
  | 'companies:manage'
  | 'users:manage'
  | 'employees:view_all'
  | 'employees:view_department'
  | 'employees:view_own'
  | 'employees:create'
  | 'employees:edit'
  | 'employees:delete'
  | 'departments:manage'
  | 'positions:manage'
  | 'attendance:manage'
  | 'attendance:view_all'
  | 'attendance:view_department'
  | 'attendance:register'
  | 'payroll:manage'
  | 'payroll:view_all'
  | 'payroll:view_own'
  | 'vacations:approve'
  | 'vacations:approve_department'
  | 'vacations:request'
  | 'documents:manage'
  | 'documents:view_own'
  | 'recruitment:manage'
  | 'performance:manage'
  | 'performance:evaluate_team'
  | 'performance:view_own'
  | 'reports:full'
  | 'reports:department'
  | 'settings:manage'

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  adm_total: [
    'companies:manage', 'users:manage',
    'employees:view_all', 'employees:create', 'employees:edit', 'employees:delete',
    'departments:manage', 'positions:manage',
    'attendance:manage', 'attendance:view_all', 'attendance:register',
    'payroll:manage', 'payroll:view_all',
    'vacations:approve', 'vacations:request',
    'documents:manage', 'documents:view_own',
    'recruitment:manage',
    'performance:manage', 'performance:evaluate_team', 'performance:view_own',
    'reports:full',
    'settings:manage',
  ],
  rh: [
    'users:manage',
    'employees:view_all', 'employees:create', 'employees:edit',
    'departments:manage', 'positions:manage',
    'attendance:manage', 'attendance:view_all', 'attendance:register',
    'payroll:manage', 'payroll:view_all',
    'vacations:approve', 'vacations:request',
    'documents:manage', 'documents:view_own',
    'recruitment:manage',
    'performance:manage', 'performance:evaluate_team', 'performance:view_own',
    'reports:full',
    'settings:manage',
  ],
  gestor: [
    'employees:view_department',
    'attendance:view_department', 'attendance:register',
    'vacations:approve_department', 'vacations:request',
    'documents:view_own',
    'performance:evaluate_team', 'performance:view_own',
    'reports:department',
  ],
  colaborador: [
    'employees:view_own',
    'attendance:register',
    'vacations:request',
    'documents:view_own',
    'performance:view_own',
    'payroll:view_own',
  ],
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}
