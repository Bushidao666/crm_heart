import { useCallback, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

import { useAuth } from '@/features/auth/hooks/use-auth'
import { env } from '@/config/env'
import { dispatchAccessRevokedEvent } from '@/features/auth/utils/access-revoked'

let activityTrackerGloballyDisabled = false

const disableGlobalActivityTracker = (reason?: string) => {
  if (activityTrackerGloballyDisabled) return
  activityTrackerGloballyDisabled = true
  if (reason) {
    console.warn('Activity tracker desativado:', reason)
  } else {
    console.warn('Activity tracker desativado.')
  }
}

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = ['click', 'keydown', 'wheel', 'touchstart', 'touchmove']

const IDLE_TIMEOUT_MS = 5 * 60_000

type ActivityEvent = 'heartbeat' | 'idle' | 'logout'

export const ActivityTracker = () => {
  const { session } = useAuth()
  const location = useLocation()
  const apiBaseUrl = env.apiUrl?.trim() ?? ''

  const accessTokenRef = useRef<string | null>(session?.access_token ?? null)
  const idleTimerRef = useRef<number | null>(null)
  const isIdleRef = useRef(false)
  const isTrackingRef = useRef(false)
  const activityDisabledRef = useRef(false)

  useEffect(() => {
    accessTokenRef.current = session?.access_token ?? null
  }, [session?.access_token])

  type InvokeOptions = {
    keepalive?: boolean
  }

  const invokeActivity = useCallback(
    async (event: ActivityEvent, accessToken: string, metadata?: Record<string, unknown>, options?: InvokeOptions) => {
      if (activityTrackerGloballyDisabled || activityDisabledRef.current) {
        return { error: null, data: null }
      }

      if (!apiBaseUrl) {
        disableGlobalActivityTracker('Backend API URL não configurada para activity tracker.')
        return { error: null, data: null }
      }

      const endpoint = `${apiBaseUrl.replace(/\/$/, '')}/activity`

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          keepalive: options?.keepalive ?? false,
          body: JSON.stringify({
            event,
            metadata,
          }),
        })

        if (response.status === 401 || response.status === 403) {
          dispatchAccessRevokedEvent({
            reason: 'activity_tracker',
            detail: `activity.${event}`,
            message: 'Sua sessão foi revogada pelo servidor.',
          })
          return {
            data: null,
            error: new Error('Sessão revogada pelo servidor.'),
          }
        }

        if (!response.ok) {
          const payload = await response.text().catch(() => null)
          return {
            data: null,
            error: new Error(
              `Falha ao registrar atividade do usuário (${response.status}): ${payload ?? 'sem payload'}`,
            ),
          }
        }

        return { data: await response.json().catch(() => null), error: null }
      } catch (error) {
        if (error instanceof Error && /failed to send a request/i.test(error.message)) {
          activityDisabledRef.current = true
          disableGlobalActivityTracker(error.message)
          return { error, data: null }
        }

        throw error
      }
    },
    [apiBaseUrl],
  )

  const scheduleIdleCheck = useCallback(() => {
    if (activityTrackerGloballyDisabled) {
      return
    }

    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current)
    }

    idleTimerRef.current = window.setTimeout(async () => {
      if (activityTrackerGloballyDisabled) return

      const token = accessTokenRef.current
      if (!token) return

      try {
        isIdleRef.current = true
        const { error } = await invokeActivity('idle', token, {
          reason: 'idle_timeout',
        })
        if (error) {
          console.error('Failed to mark user idle', error)
        }
      } catch (error) {
        console.error('Failed to mark user idle', error)
      }
    }, IDLE_TIMEOUT_MS)
  }, [invokeActivity])

  const registerHeartbeat = useCallback(
    async (metadata?: Record<string, unknown>) => {
      if (activityTrackerGloballyDisabled) {
        return
      }

      const token = accessTokenRef.current
      if (!token) return

      try {
        const { error } = await invokeActivity('heartbeat', token, metadata)
        if (error) {
          if (!activityTrackerGloballyDisabled && !activityDisabledRef.current) {
            console.error('Failed to register user activity', error)
          }
          return
        }

        isIdleRef.current = false
      } catch (error) {
        if (!activityTrackerGloballyDisabled) {
          console.error('Failed to register user activity', error)
        }
      }
    },
    [invokeActivity],
  )

  const handleActivityEvent = useCallback(
    (metadata?: Record<string, unknown>) => {
      if (activityTrackerGloballyDisabled || !accessTokenRef.current) return

      void registerHeartbeat(metadata)
      scheduleIdleCheck()
    },
    [registerHeartbeat, scheduleIdleCheck],
  )

  const handleVisibilityChange = useCallback(() => {
    if (activityTrackerGloballyDisabled || !accessTokenRef.current) return

    if (document.hidden) {
      return
    }

    void registerHeartbeat({
      reason: 'document_visible',
    })
    scheduleIdleCheck()
  }, [registerHeartbeat, scheduleIdleCheck])

  useEffect(() => {
    if (activityTrackerGloballyDisabled || !session?.access_token) {
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
      isTrackingRef.current = false
      return
    }

    if (isTrackingRef.current) {
      return
    }

    const handleEvent = (event: Event) => {
      const target = event.target
      const targetElement =
        target instanceof Element ? target : target instanceof Node ? (target.parentElement ?? null) : null

      if (targetElement?.closest('[data-activity-ignore="true"]')) {
        return
      }

      handleActivityEvent({
        event: event.type,
      })
    }

    ACTIVITY_EVENTS.forEach((eventName) => {
      document.addEventListener(eventName, handleEvent, { passive: true })
    })

    window.addEventListener('focus', handleEvent)
    window.addEventListener('blur', handleEvent)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Kick off an initial heartbeat and idle timer.
    void registerHeartbeat({ reason: 'session_start' })
    scheduleIdleCheck()

    isTrackingRef.current = true

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        document.removeEventListener(eventName, handleEvent)
      })

      window.removeEventListener('focus', handleEvent)
      window.removeEventListener('blur', handleEvent)
      document.removeEventListener('visibilitychange', handleVisibilityChange)

      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
      isTrackingRef.current = false
    }
  }, [handleActivityEvent, handleVisibilityChange, registerHeartbeat, scheduleIdleCheck, session?.access_token])

  useEffect(() => {
    if (activityTrackerGloballyDisabled || !session?.access_token) {
      return
    }

    handleActivityEvent({
      event: 'route_change',
      path: location.pathname,
    })
  }, [handleActivityEvent, location.pathname, session?.access_token])

  useEffect(() => {
    if (activityTrackerGloballyDisabled) return

    const handlePageHide = (event: PageTransitionEvent) => {
      if (activityTrackerGloballyDisabled || !accessTokenRef.current) {
        return
      }

      const isPersisted = 'persisted' in event && event.persisted

      void invokeActivity(
        'logout',
        accessTokenRef.current,
        { reason: document.visibilityState === 'hidden' ? 'page_hidden' : 'page_unload' },
        { keepalive: !isPersisted },
      ).catch(() => null)
    }

    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handlePageHide)

    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handlePageHide)
    }
  }, [invokeActivity])

  const lastAccessTokenRef = useRef<string | null>(session?.access_token ?? null)

  useEffect(() => {
    if (activityTrackerGloballyDisabled) {
      lastAccessTokenRef.current = session?.access_token ?? null
      return
    }

    const previousToken = lastAccessTokenRef.current
    const currentToken = session?.access_token ?? null

    if (previousToken && !currentToken) {
      void invokeActivity('logout', previousToken, { reason: 'session_end' }, { keepalive: true }).catch(() => null)
    }

    lastAccessTokenRef.current = currentToken
  }, [invokeActivity, session?.access_token])

  useEffect(() => {
    const handleManualLogout = (event: Event) => {
      if (activityTrackerGloballyDisabled || !accessTokenRef.current) {
        return
      }

      const reason =
        event instanceof CustomEvent && event.detail && typeof event.detail === 'object'
          ? (event.detail.reason as string | undefined)
          : undefined

      void invokeActivity('logout', accessTokenRef.current, { reason: reason ?? 'manual_logout' }, { keepalive: true }).catch(
        () => null,
      )
    }

    window.addEventListener('crm-heart:manual-logout', handleManualLogout as EventListener)

    return () => {
      window.removeEventListener('crm-heart:manual-logout', handleManualLogout as EventListener)
    }
  }, [invokeActivity])

  return null
}
