import { LoginForm } from '@/features/auth/components/login-form'

import styles from './login-page.module.css'

export const LoginPage = () => {
  return (
    <section className={styles.wrapper}>
      <div className={styles.card}>
        <header className={styles.header}>
          <h1 className={styles.title}>CRM Heart</h1>
          <p className={styles.subtitle}>Acesse sua conta para continuar.</p>
        </header>

        <div className={styles.formArea}>
          <LoginForm />
          <p className={styles.formHelper}>Use as credenciais fornecidas pela equipe de TI.</p>
        </div>
      </div>
    </section>
  )
}
