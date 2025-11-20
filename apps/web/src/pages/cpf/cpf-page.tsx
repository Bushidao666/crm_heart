import { FormEvent, useEffect, useMemo, useState } from 'react'

import { InlineError } from '@/components/inline-error'
import { useCpfConsultation } from '@/features/cpf/hooks/use-cpf-consultation'
import { CpfResultModal } from '@/features/cpf/components/cpf-result-modal'

import styles from './cpf-page.module.css'

const formatCpfInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11)

  if (digits.length <= 3) {
    return digits
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`
  }

  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}

const sanitizeCpf = (value: string) => value.replace(/\D/g, '')

const STORAGE_KEYS = {
  cpf: 'crm-heart:cpf-consultation:input',
  touched: 'crm-heart:cpf-consultation:touched',
  dismissed: 'crm-heart:cpf-consultation:dismissed',
}

const isBrowser = typeof window !== 'undefined'

const loadStoredCpf = () => {
  if (!isBrowser) return ''
  return window.sessionStorage.getItem(STORAGE_KEYS.cpf) ?? ''
}

const loadStoredTouched = () => {
  if (!isBrowser) return false
  return window.sessionStorage.getItem(STORAGE_KEYS.touched) === 'true'
}

const loadDismissedId = () => {
  if (!isBrowser) return null
  return window.sessionStorage.getItem(STORAGE_KEYS.dismissed)
}

export const CpfPage = () => {
  const [cpf, setCpf] = useState(() => loadStoredCpf())
  const [touchedState, setTouchedState] = useState(() => loadStoredTouched())
  const { consult, isLoading, error, result, reset } = useCpfConsultation()
  const [isModalOpen, setIsModalOpen] = useState(() => Boolean(result))
  const [dismissedResultId, setDismissedResultId] = useState<string | null>(() => loadDismissedId())

  const setTouched = (value: boolean) => {
    setTouchedState(value)
    if (!isBrowser) return
    if (value) {
      window.sessionStorage.setItem(STORAGE_KEYS.touched, 'true')
    } else {
      window.sessionStorage.removeItem(STORAGE_KEYS.touched)
    }
  }

  const sanitizedCpf = useMemo(() => sanitizeCpf(cpf), [cpf])
  const isValid = sanitizedCpf.length === 11

  useEffect(() => {
    if (result) {
      const currentResultId = JSON.stringify(result)
      if (!isLoading && currentResultId !== dismissedResultId) {
        setIsModalOpen(true)
      }
    }
  }, [result, dismissedResultId, isLoading])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTouched(true)
    if (isBrowser) {
      window.sessionStorage.setItem(STORAGE_KEYS.touched, 'true')
    }
    if (!isValid || isLoading) return
    setIsModalOpen(false)
    if (result) {
      const currentResultId = JSON.stringify(result)
      setDismissedResultId(currentResultId)
      if (isBrowser) {
        window.sessionStorage.setItem(STORAGE_KEYS.dismissed, currentResultId)
      }
    } else {
      setDismissedResultId(null)
      if (isBrowser) {
        window.sessionStorage.removeItem(STORAGE_KEYS.dismissed)
      }
    }
    void consult({ cpf })
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCpfInput(event.target.value)
    setCpf(formatted)
    if (isBrowser) {
      if (formatted) {
        window.sessionStorage.setItem(STORAGE_KEYS.cpf, formatted)
      } else {
        window.sessionStorage.removeItem(STORAGE_KEYS.cpf)
      }
    }
  }

  const handleNewConsultation = () => {
    setCpf('')
    setTouched(false)
    setIsModalOpen(false)
    setDismissedResultId(null)
    if (isBrowser) {
      window.sessionStorage.removeItem(STORAGE_KEYS.dismissed)
    }
    reset()
    if (isBrowser) {
      window.sessionStorage.removeItem(STORAGE_KEYS.cpf)
      window.sessionStorage.removeItem(STORAGE_KEYS.touched)
    }
  }

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h1>Consulta de CPF</h1>
        <p>Verifique a situação financeira de um CPF integrado ao fluxo via n8n.</p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.field}>
          <span>CPF</span>
          <input
            type="text"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={handleChange}
            onBlur={() => setTouched(true)}
            maxLength={14}
            inputMode="numeric"
          />
        </label>
        <InlineError message={touchedState && !isValid ? 'Informe um CPF válido com 11 dígitos.' : null} />
        <InlineError message={error} />

        <div className={styles.actions}>
          <button type="submit" disabled={!isValid || isLoading} className={styles.primaryButton}>
            {isLoading ? 'Consultando...' : 'Buscar situação'}
          </button>
        </div>
      </form>

      {result && !isModalOpen ? (
        <button type="button" className={styles.reopenButton} onClick={() => setIsModalOpen(true)}>
          Ver resultado da última consulta
        </button>
      ) : null}

      {result && isModalOpen ? (
        <CpfResultModal
          result={result}
          onClose={() => {
            setIsModalOpen(false)
            setDismissedResultId(JSON.stringify(result))
            if (isBrowser) {
              window.sessionStorage.setItem(STORAGE_KEYS.dismissed, JSON.stringify(result))
            }
          }}
          onNewConsultation={handleNewConsultation}
        />
      ) : null}
    </section>
  )
}
