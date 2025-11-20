import { Navigate } from 'react-router-dom'
import type { CSSProperties, ReactNode } from 'react'

import { useAuth } from '@/features/auth/hooks/use-auth'
import type { UserRole } from '@/features/auth/types'

const loaderStyle: CSSProperties = {
  display: 'flex',
  minHeight: '100vh',
  width: '100%',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'var(--surface)',
  color: 'var(--muted-foreground)',
  fontSize: '0.95rem',
  fontWeight: 500,
}

type ProtectedRouteProps = {
  children: ReactNode
  redirectTo?: string
  allowRoles?: UserRole[]
}

export const ProtectedRoute = ({
  children,
  redirectTo = '/auth/login',
  allowRoles,
}: ProtectedRouteProps) => {
  const { user, isLoading, isProfileLoading, hasRole } = useAuth()

  if (isLoading || isProfileLoading) {
    return <div style={loaderStyle}>Carregando...</div>
  }

  if (!user) {
    return <Navigate to={redirectTo} replace />
  }

  if (allowRoles && allowRoles.length > 0) {
    if (!hasRole(allowRoles)) {
      return <Navigate to="/auth/forbidden" replace />
    }
  }

  return <>{children}</>
}
