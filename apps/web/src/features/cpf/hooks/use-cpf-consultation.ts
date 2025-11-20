import { useCallback, useEffect, useRef, useState } from 'react'

import { supabase } from '@/lib/supabase-client'
import type { CpfConsultationPayload, CpfConsultationResult } from '@/features/cpf/types'

const sanitizeCpf = (value: string) => value.replace(/\D/g, '')

const STORAGE_PREFIX = 'crm-heart:cpf-consultation'
const RESULT_STORAGE_KEY = `${STORAGE_PREFIX}:result`
const ERROR_STORAGE_KEY = `${STORAGE_PREFIX}:error`

const isBrowser = typeof window !== 'undefined'

const loadStoredResult = (): CpfConsultationResult | null => {
  if (!isBrowser) return null
  const raw = window.sessionStorage.getItem(RESULT_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as CpfConsultationResult
  } catch (error) {
    console.warn('Failed to parse stored CPF consultation result', error)
    window.sessionStorage.removeItem(RESULT_STORAGE_KEY)
    return null
  }
}

const persistResult = (value: CpfConsultationResult | null) => {
  if (!isBrowser) return
  if (!value) {
    window.sessionStorage.removeItem(RESULT_STORAGE_KEY)
    return
  }
  window.sessionStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(value))
}

const loadStoredError = (): string | null => {
  if (!isBrowser) return null
  return window.sessionStorage.getItem(ERROR_STORAGE_KEY)
}

const persistError = (value: string | null) => {
  if (!isBrowser) return
  if (!value) {
    window.sessionStorage.removeItem(ERROR_STORAGE_KEY)
    return
  }
  window.sessionStorage.setItem(ERROR_STORAGE_KEY, value)
}

export const useCpfConsultation = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResultState] = useState<CpfConsultationResult | null>(() => loadStoredResult())
  const [error, setErrorState] = useState<string | null>(() => loadStoredError())
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const setResult = useCallback((value: CpfConsultationResult | null) => {
    persistResult(value)
    if (isMountedRef.current) {
      setResultState(value)
    }
  }, [])

  const setError = useCallback((value: string | null) => {
    persistError(value)
    if (isMountedRef.current) {
      setErrorState(value)
    }
  }, [])

  const consult = useCallback(async (payload: CpfConsultationPayload) => {
    if (isMountedRef.current) {
      setIsLoading(true)
    }
    setError(null)

    const cpf = sanitizeCpf(payload.cpf)

    const { data, error: fnError } = await supabase.functions.invoke<CpfConsultationResult>('cpf-consultation', {
      body: { cpf },
    })

    if (fnError) {
      console.error('Failed to execute CPF consultation', fnError)
      setError(fnError.message ?? 'Não foi possível consultar o CPF. Tente novamente.')
      if (isMountedRef.current) {
        setIsLoading(false)
      }
      return
    }

    if (data?.status === 'error') {
      setError(data.message ?? 'Não foi possível consultar o CPF. Tente novamente.')
      setResult(data)
      if (isMountedRef.current) {
        setIsLoading(false)
      }
      return
    }

    setResult(data ?? null)
    if (isMountedRef.current) {
      setIsLoading(false)
    }
  }, [setError, setResult])

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
    if (isMountedRef.current) {
      setIsLoading(false)
    }
  }, [setError, setResult])

  return { isLoading, result, error, consult, reset }
}
