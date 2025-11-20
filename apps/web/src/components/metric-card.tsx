import clsx from 'clsx'

import styles from './metric-card.module.css'

type MetricCardProps = {
  title: string
  value: number | string
  description?: string
  tone?: 'default' | 'success' | 'warning' | 'danger'
  isLoading?: boolean
}

export const MetricCard = ({ title, value, description, tone = 'default', isLoading = false }: MetricCardProps) => {
  return (
    <article className={clsx(styles.card, styles[tone])}>
      <header className={styles.header}>
        <h3>{title}</h3>
      </header>
      <div className={styles.content}>{isLoading ? <span className={styles.skeleton} /> : <span>{value}</span>}</div>
      {description ? <p className={styles.description}>{description}</p> : null}
    </article>
  )
}
