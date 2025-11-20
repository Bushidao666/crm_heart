import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { CompanyContext } from '@/app/providers/company-context'
import { useAuth } from '@/features/auth/hooks/use-auth'

type CompanyProviderProps = {
  children: ReactNode
}

export const CompanyProvider = ({ children }: CompanyProviderProps) => {
  const { profile, isLoading } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const resolvedSchema = profile?.schema ?? 'heart'

  useEffect(() => {
    if (isLoading) {
      return
    }

    if (profile && !profile.company_id) {
      setError('Usuário não está vinculado a nenhuma empresa ativa.')
      return
    }

    setError(null)
  }, [profile, isLoading])

  const value = useMemo(
    () => ({
      companyId: profile?.company_id ?? null,
      schema: resolvedSchema,
      isLoading,
      error,
    }),
    [profile?.company_id, resolvedSchema, isLoading, error],
  )

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
}
