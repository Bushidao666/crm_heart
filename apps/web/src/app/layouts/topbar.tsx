import { useAuth } from '@/features/auth/hooks/use-auth'

import styles from './topbar.module.css'

export const Topbar = () => {
  const { user, profile, signOut, isAuthenticating } = useAuth()

  const handleSignOut = async () => {
    const result = await signOut()

    if (!result.ok && result.message) {
      console.error(result.message)
    }
  }

  const userInitial = user?.email?.[0]?.toUpperCase() ?? '?'
  const userEmail = user?.email ?? 'Usuário não autenticado'
  const userRole = profile?.role ?? 'Definindo permissões'

  return (
    <header className={styles.topbar}>
      <div className={styles.heading}>
        <h1 className={styles.headingTitle}>Bem-vindo(a) ao CRM Heart</h1>
        <p className={styles.headingSubtitle}>
          Organize leads, negócios e automações em um único lugar.
        </p>
      </div>

      <div className={styles.userCard}>
        <div className={styles.avatar}>{userInitial}</div>
        <div className={styles.userInfo}>
          <span className={styles.userName}>{userEmail}</span>
          <span className={styles.userRole}>{userRole}</span>
        </div>
        {user ? (
          <button
            type="button"
            className={styles.logoutButton}
            onClick={handleSignOut}
            data-activity-ignore="true"
            disabled={isAuthenticating}
          >
            {isAuthenticating ? 'Saindo...' : 'Sair'}
          </button>
        ) : null}
      </div>
    </header>
  )
}
