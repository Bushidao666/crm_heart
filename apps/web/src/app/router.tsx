import { Navigate, createBrowserRouter } from 'react-router-dom'

import { ProtectedRoute } from '@/app/components/protected-route'
import { AppLayout } from '@/app/layouts/app-layout'
import { DashboardPage } from '@/pages/dashboard/dashboard-page'
import { LeadsPage } from '@/pages/leads/leads-page'
import { DealsPage } from '@/pages/deals/deals-page'
import { ServicesPage } from '@/pages/services/services-page'
import { ContractsPage } from '@/pages/contracts/contracts-page'
import { ContractsTrackingPage } from '@/pages/contracts/contracts-tracking-page'
import { TeamPage } from '@/pages/team/team-page'
import { MetricsPage } from '@/pages/metrics/metrics-page'
import { CpfPage } from '@/pages/cpf'
import { LoginPage } from '@/pages/auth/login-page'
import { ForbiddenPage } from '@/pages/auth/forbidden-page'
import { AccessRevokedPage } from '@/pages/auth/access-revoked-page'
import { ADMIN_ROLES, METRICS_ROLES } from '@/features/auth/constants'

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'contracts/tracking',
        element: <ContractsTrackingPage />,
      },
      {
        path: 'leads',
        element: <LeadsPage />,
      },
      {
        path: 'deals',
        element: <DealsPage />,
      },
      {
        path: 'services',
        element: (
          <ProtectedRoute allowRoles={ADMIN_ROLES}>
            <ServicesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'contracts/templates',
        element: (
          <ProtectedRoute allowRoles={ADMIN_ROLES}>
            <ContractsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'team',
        element: (
          <ProtectedRoute allowRoles={ADMIN_ROLES}>
            <TeamPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'cpf',
        element: <CpfPage />,
      },
      {
        path: 'metrics',
        element: (
          <ProtectedRoute allowRoles={METRICS_ROLES}>
            <MetricsPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: '/auth/login',
    element: <LoginPage />,
  },
  {
    path: '/auth/access-revoked',
    element: <AccessRevokedPage />,
  },
  {
    path: '/auth/forbidden',
    element: <ForbiddenPage />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
