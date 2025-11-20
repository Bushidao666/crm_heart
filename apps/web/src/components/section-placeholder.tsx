import styles from './section-placeholder.module.css'

type SectionPlaceholderProps = {
  title: string
  description: string
  helper?: string
}

export const SectionPlaceholder = ({ title, description, helper }: SectionPlaceholderProps) => {
  return (
    <section className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
        {helper ? <p className={styles.helper}>{helper}</p> : null}
      </div>
    </section>
  )
}
