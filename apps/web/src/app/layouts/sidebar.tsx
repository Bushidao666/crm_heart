import { NavLink } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { METRICS_ROLES } from '@/features/auth/constants'
import type { UserRole } from '@/features/auth/types'

import styles from './sidebar.module.css'

type NavigationItem = {
  path: string
  label: string
  roles?: UserRole[]
}

const baseNavigationItems: NavigationItem[] = [
  { path: '/leads', label: 'Leads' },
  { path: '/deals', label: 'Negócios' },
  { path: '/cpf', label: 'Consultar CPF' },
]

const adminNavigationItems: NavigationItem[] = [
  { path: '/contracts/tracking', label: 'Contratos', roles: ['admin'] },
  { path: '/contracts/templates', label: 'Templates de contrato', roles: ['admin'] },
  { path: '/services', label: 'Serviços', roles: ['admin'] },
  { path: '/team', label: 'Equipe', roles: ['admin'] },
  { path: '/metrics', label: 'Métricas', roles: METRICS_ROLES },
]

export const Sidebar = () => {
  const { profile } = useAuth()
  const userRole = profile?.role

  const combinedItems = [...baseNavigationItems, ...adminNavigationItems]

  const filteredItems = combinedItems.filter((item) => {
    if (!item.roles) return true
    if (!userRole) return false
    return item.roles.includes(userRole)
  })

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.brand}>CRM Heart</span>
        <p className={styles.subtitle}>Gestão completa de relacionamento</p>
      </div>

      <nav className={styles.nav}>
        <ul className={styles.navList}>
          {filteredItems.map(({ path, label }) => (
            <li key={path}>
              <NavLink
                to={path}
                className={({ isActive }) =>
                  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                }
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
