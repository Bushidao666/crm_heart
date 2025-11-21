import type { UserRole } from '@/features/auth/types'

export const ADMIN_ROLES: UserRole[] = ['admin', 'brain_admin', 'crm_admin']

// Roles que podem acessar a sessão de métricas (admin + times de venda)
export const METRICS_ROLES: UserRole[] = [
  ...ADMIN_ROLES,
  'vendedor',
  'sales_rep',
  'closer',
  'manager',
]
