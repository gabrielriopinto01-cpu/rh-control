import type { UserRole } from './database'

export interface AuthUser {
  id: string
  email: string
  company_id: string
  company_slug: string
  role: UserRole
  full_name: string
  avatar_url: string | null
}

export interface Session {
  user: AuthUser
  access_token: string
  expires_at: number
}
