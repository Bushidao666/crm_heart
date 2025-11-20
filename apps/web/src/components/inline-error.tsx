import clsx from 'clsx'

import styles from './inline-error.module.css'

type InlineErrorProps = {
  message: string | null
  tone?: 'default' | 'warning' | 'danger'
}

export const InlineError = ({ message, tone = 'danger' }: InlineErrorProps) => {
  if (!message) return null
  return <p className={clsx(styles.error, styles[tone])}>{message}</p>
}
