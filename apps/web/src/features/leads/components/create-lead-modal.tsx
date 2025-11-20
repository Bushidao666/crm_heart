import { useState } from 'react'

import { formatPhone } from '@/features/deals/utils/format'

import styles from './create-lead-modal.module.css'

type CreateLeadModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (payload: { firstName: string; lastName?: string; email?: string; phone?: string }) => Promise<void>
}

export const CreateLeadModal = ({ open, onClose, onSubmit }: CreateLeadModalProps) => {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!firstName.trim()) {
      setError('Informe o primeiro nome do lead.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      })
      setFirstName('')
      setLastName('')
      setEmail('')
      setPhone('')
    } catch (submitError) {
      console.error(submitError)
      setError((submitError as Error).message ?? 'Não foi possível criar o lead.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <header className={styles.header}>
          <h2 className={styles.title}>Novo lead</h2>
          <p className={styles.subtitle}>Cadastre rapidamente um lead manual preenchendo as informações abaixo.</p>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.fieldGroup}>
            <label className={styles.field}>
              <span>Primeiro nome *</span>
              <input value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
            </label>
            <label className={styles.field}>
              <span>Sobrenome</span>
              <input value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </label>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.field}>
              <span>Telefone</span>
              <input
                value={phone}
                onChange={(event) => setPhone(formatPhone(event.target.value))}
                placeholder="(00) 00000-0000"
              />
            </label>
            <label className={styles.field}>
              <span>Email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}

          <footer className={styles.footer}>
            <button type="button" className={styles.cancelButton} onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Criar lead'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
