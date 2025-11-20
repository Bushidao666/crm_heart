import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'

import styles from './login-form.module.css'

export const LoginForm = () => {
  const navigate = useNavigate()
  const { signInWithPassword, authError, isAuthenticating, clearAuthError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (!email || !password) {
      setFormError('Preencha e-mail e senha para continuar.')
      return
    }

    const result = await signInWithPassword({ email, password })

    if (result.ok) {
      navigate('/')
      return
    }

    setFormError(result.message ?? 'Não foi possível acessar sua conta.')
  }

  const errorMessage = formError ?? authError

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="seuemail@empresa.com"
          className={styles.input}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            if (errorMessage) {
              setFormError(null)
              clearAuthError()
            }
          }}
          disabled={isAuthenticating}
          required
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="password">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Digite sua senha"
          className={styles.input}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
            if (errorMessage) {
              setFormError(null)
              clearAuthError()
            }
          }}
          disabled={isAuthenticating}
          required
        />
      </div>

      {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}

      <button type="submit" className={styles.submitButton} disabled={isAuthenticating}>
        {isAuthenticating ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  )
}
