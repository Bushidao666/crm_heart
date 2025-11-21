import { useCallback, useMemo, useRef, useState } from 'react'

import styles from './toast-provider.module.css'
import { ToastContext, type ToastInput, type ToastItem } from './toast-context'

const generateId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timeoutRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timeoutId = timeoutRefs.current[id]
    if (timeoutId) {
      clearTimeout(timeoutId)
      delete timeoutRefs.current[id]
    }
  }, [])

  const showToast = useCallback(
    ({ title, description, variant = 'default', duration = 4000 }: ToastInput) => {
      if (!title) return
      const id = generateId()
      const toast: ToastItem = {
        id,
        title,
        description,
        variant,
        duration,
        expiresAt: duration > 0 ? Date.now() + duration : null,
      }

      setToasts((current) => [...current, toast])

      if (duration > 0) {
        const timeoutId = setTimeout(() => removeToast(id), duration)
        timeoutRefs.current[id] = timeoutId
      }
    },
    [removeToast],
  )

  const contextValue = useMemo(() => showToast, [showToast])

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className={styles.viewport}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${styles.toast} ${toast.variant === 'success' ? styles.success : ''} ${toast.variant === 'error' ? styles.error : ''}`}
            role="status"
            aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
          >
            <div className={styles.toastHeader}>
              <strong>{toast.title}</strong>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className={styles.toastCloseButton}
                aria-label="Fechar notificação"
              >
                ×
              </button>
            </div>
            {toast.description ? <p>{toast.description}</p> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
