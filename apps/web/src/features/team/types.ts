import type { UserRole } from '@/features/auth/types'

export type TeamMember = {
  id: string
  user_id: string | null
  user_name: string | null
  user_email: string
  role: UserRole
  metadata: Record<string, unknown> | null
  last_session: Record<string, unknown> | null
  status: string | null
  last_activity: string | null
  created_at: string | null
  updated_at: string | null
}

export type InviteMemberPayload = {
  name: string
  email: string
  role: UserRole
}
