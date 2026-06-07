'use client'

import { useAuth } from './use-auth'
import { hasPermission, type Permission } from '@/lib/constants/permissions'

export function usePermissions() {
  const { user } = useAuth()

  const can = (permission: Permission): boolean => {
    if (!user) return false
    return hasPermission(user.role, permission)
  }

  const canAny = (...permissions: Permission[]): boolean => {
    return permissions.some(can)
  }

  return { can, canAny, role: user?.role }
}
