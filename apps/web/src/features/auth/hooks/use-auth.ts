import { useCallback, useState } from 'react'

import { useAuthContext } from '@/app/providers/use-auth-context'
import { supabase } from '@/lib/supabase-client'
import type { UserRole } from '@/features/auth/types'
import { dispatchAccessRevokedEvent } from '@/features/auth/utils/access-revoked'
import { getSessionBanMetadata, isSessionBanned } from '@/features/auth/utils/user-ban'

export type SignInCredentials = {
  email: string
  password: string
}

export type AuthOperationResult = {
  ok: boolean
  message?: string
}

export const useAuth = () => {
  const {
    session,
    user,
    profile,
    isLoading,
    isProfileLoading,
    profileError,
    refreshProfile,
  } = useAuthContext()
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const handleError = useCallback((error: unknown, fallbackMessage: string) => {
    if (error instanceof Error) {
      setAuthError(error.message)
      return error.message
    }

    console.error(fallbackMessage, error)
    setAuthError(fallbackMessage)
    return fallbackMessage
  }, [])

  const signInWithPassword = useCallback(
    async ({ email, password }: SignInCredentials): Promise<AuthOperationResult> => {
      setIsAuthenticating(true)
      setAuthError(null)

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          const message = handleError(error, 'Não foi possível autenticar. Verifique suas credenciais.')
          return { ok: false, message }
        }

        const sessionSnapshot = data?.session ?? (await supabase.auth.getSession().then(({ data: sessionData }) => sessionData.session).catch(() => null))

        if (isSessionBanned(sessionSnapshot)) {
          const metadata = getSessionBanMetadata(sessionSnapshot)
          const message =
            'Seu acesso foi revogado pela administração do CRM Heart. Caso seja um engano, contate um administrador.'

          dispatchAccessRevokedEvent({
            reason: 'login_banned',
            banReason: metadata.banReason,
            message,
          })

          return { ok: false, message }
        }

        await refreshProfile()
        return { ok: true }
      } catch (error) {
        const message = handleError(error, 'Ocorreu um erro inesperado ao autenticar.')
        return { ok: false, message }
      } finally {
        setIsAuthenticating(false)
      }
    },
    [handleError, refreshProfile],
  )

  const signOut = useCallback(async (): Promise<AuthOperationResult> => {
    setIsAuthenticating(true)
    setAuthError(null)

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('crm-heart:manual-logout', {
            detail: {
              reason: 'sign_out',
            },
          }),
        )
      }

      const { error } = await supabase.auth.signOut()

      if (error) {
        const message = handleError(error, 'Não foi possível encerrar a sessão atual.')
        return { ok: false, message }
      }

      await refreshProfile()
      return { ok: true }
    } catch (error) {
      const message = handleError(error, 'Ocorreu um erro inesperado ao encerrar a sessão.')
      return { ok: false, message }
    } finally {
      setIsAuthenticating(false)
    }
  }, [handleError, refreshProfile])

  const clearAuthError = useCallback(() => {
    setAuthError(null)
  }, [])

  const hasRole = useCallback(
    (roles: UserRole[]) => {
      if (!profile?.role) return false
      return roles.includes(profile.role)
    },
    [profile?.role],
  )

  return {
    session,
    user,
    isLoading,
    isProfileLoading,
    profile,
    profileError,
    isAuthenticating,
    authError,
    signInWithPassword,
    signOut,
    clearAuthError,
    refreshProfile,
    hasRole,
  }
}
