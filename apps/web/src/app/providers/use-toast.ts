import { useContext } from 'react'

import type { ToastInput } from './toast-context'
import { ToastContext } from './toast-context'

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast deve ser utilizado dentro de um ToastProvider')
  }
  return context
}

export type { ToastInput }
