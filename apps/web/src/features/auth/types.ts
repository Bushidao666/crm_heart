export type UserRole = 'admin' | 'brain_admin' | 'vendedor' | 'sales_rep' | 'manager' | 'crm_admin' | 'closer'

export type CompanySchema = 'heart' | 'core'

export type UserLastSession = {
  ip_address?: string | null
  geolocation?: Record<string, unknown> | null
  user_agent?: string | null
  last_geolocation_at?: string | null
} | null

export type UserProfile = {
  id: string
  company_id: string | null
  user_name: string | null
  user_email: string
  role: UserRole | null
  ip_address: string | null
  geolocation: Record<string, unknown> | null
  last_session: UserLastSession
  status: string | null
  last_activity: string | null
  created_at?: string | null
  updated_at?: string | null
  schema: CompanySchema | null
}
