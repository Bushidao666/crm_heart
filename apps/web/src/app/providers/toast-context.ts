import { createContext } from 'react'

export type ToastVariant = 'default' | 'success' | 'error'

export type ToastInput = {
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

export type ToastItem = ToastInput & { id: string; variant: ToastVariant; expiresAt?: number | null }

export const ToastContext = createContext<((toast: ToastInput) => void) | null>(null)
