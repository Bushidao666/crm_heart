import { createContext } from 'react'

export type CompanyContextValue = {
  companyId: string | null
  schema: 'heart' | 'core'
  isLoading: boolean
  error: string | null
}

export const CompanyContext = createContext<CompanyContextValue | undefined>(undefined)
