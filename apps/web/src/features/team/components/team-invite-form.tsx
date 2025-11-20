import { useState } from 'react'
import type { FormEvent } from 'react'

import type { UserRole } from '@/features/auth/types'
import type { TeamInviteResult } from '@/features/team/hooks/use-team-management'

import styles from './team-invite-form.module.css'

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'vendedor', label: 'Vendedor' },
]

type TeamInviteFormProps = {
  isInviting: boolean
  infoMessage: string | null
  onInvite: (payload: { email: string; role: UserRole; name: string }) => Promise<TeamInviteResult>
  onInviteSuccess?: (result: TeamInviteResult) => void
}

export const TeamInviteForm = ({ isInviting, infoMessage, onInvite, onInviteSuccess }: TeamInviteFormProps) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('vendedor')
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (!name.trim()) {
      setFormError('Informe o nome do usuário.')
      return
    }

    if (!email) {
      setFormError('Informe o e-mail para criar o usuário.')
      return
    }

    const result = await onInvite({ email, role, name })

    if (result.ok) {
      setName('')
      setEmail('')
      if (onInviteSuccess) {
        onInviteSuccess(result)
      }
      return
    }

    if (result.message) {
      setFormError(result.message)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.fieldsRow}>
        <label className={styles.field}>
          <span className={styles.label}>Nome completo</span>
          <input
            type="text"
            placeholder="Nome e sobrenome"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            disabled={isInviting}
            className={styles.input}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>E-mail corporativo</span>
          <input
            type="email"
            placeholder="exemplo@empresa.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={isInviting}
            className={styles.input}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Função</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
            disabled={isInviting}
            className={styles.select}
            required
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {formError ? <p className={styles.error}>{formError}</p> : null}
      {infoMessage ? <p className={styles.info}>{infoMessage}</p> : null}

      <button type="submit" className={styles.submitButton} disabled={isInviting}>
        {isInviting ? 'Criando usuário...' : 'Criar usuário'}
      </button>
    </form>
  )
}
