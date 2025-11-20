import styles from './dashboard-page.module.css'

export const DashboardPage = () => {
  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h2 className={styles.title}>Visão geral</h2>
        <p className={styles.subtitle}>Métricas e indicadores principais aparecerão aqui em tempo real.</p>
      </header>

      <div className={styles.grid}>
        {[1, 2, 3, 4].map((card) => (
          <article key={card} className={styles.card}>
            <span className={styles.metricLabel}>Métrica {card}</span>
            <p className={styles.metricValue}>0</p>
            <p className={styles.metricHint}>Placeholder até implementação das métricas.</p>
          </article>
        ))}
      </div>
    </section>
  )
}
