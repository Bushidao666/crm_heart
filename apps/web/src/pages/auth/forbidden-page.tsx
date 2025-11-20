import { Link } from 'react-router-dom'

import styles from './forbidden-page.module.css'

export const ForbiddenPage = () => {
  return (
    <section className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>Acesso restrito</h1>
        <p className={styles.description}>
          Você não possui permissão para acessar este conteúdo. Caso acredite que isso seja um engano,
          fale com um administrador do CRM Heart.
        </p>
        <Link to="/" className={styles.link}>
          Voltar para o início
        </Link>
      </div>
    </section>
  )
}
