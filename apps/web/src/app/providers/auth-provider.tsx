import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { AuthContext } from '@/app/providers/auth-context'
import { coreSupabase, heartSupabase, supabase } from '@/lib/supabase-client'
import type { AuthContextValue } from '@/app/providers/auth-context'
import type { CompanySchema, UserProfile, UserRole } from '@/features/auth/types'
import { env } from '@/config/env'
import {
  ACCESS_REVOKED_EVENT,
  dispatchAccessRevokedEvent,
  persistAccessRevokedInfo,
  type AccessRevokedEventDetail,
} from '@/features/auth/utils/access-revoked'
import { getSessionBanMetadata, isSessionBanned } from '@/features/auth/utils/user-ban'

type EnforceAccessRevocationHandler = (
  session: AuthContextValue['session'],
  detail?: AccessRevokedEventDetail,
) => Promise<void> | void

type TeamMemberRow = {
  id: string
  user_id: string | null
  company_id: string | null
  user_name: string | null
  user_email: string | null
  role: string | null
  status: string | null
  last_activity: string | null
  metadata: {
    ip_address?: string | null
    geolocation?: Record<string, unknown> | null
  } | null
  last_session: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
}

const selectColumns =
  'id, user_id, company_id, user_name, user_email, role, status, last_activity, metadata, last_session, created_at, updated_at'

const parseSchemaPriority = (): CompanySchema[] => {
  const value = env.profileSchemaPriority?.trim()
  const fallback: CompanySchema[] = ['heart', 'core']

  if (!value) {
    return fallback
  }

  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter((schema): schema is CompanySchema => schema === 'heart' || schema === 'core')
    .filter((schema, index, self) => self.indexOf(schema) === index)

  return parsed.length > 0 ? parsed : fallback
}

const profileSchemaPriority = parseSchemaPriority()

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const apiBaseUrl = env.apiUrl?.trim() ?? ''
  const [session, setSession] = useState<AuthContextValue['session']>(null)
  const [isSessionLoading, setIsSessionLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const geolocationRequestRef = useRef(false)
  const schemaBlacklistRef = useRef<Set<CompanySchema>>(new Set())
  const loggedSchemasRef = useRef<Set<string>>(new Set())
  const lastSessionRef = useRef<AuthContextValue['session']>(null)
  const sessionSnapshotRef = useRef<AuthContextValue['session']>(null)
  const banHandledRef = useRef(false)
  const enforceAccessRevocationRef = useRef<EnforceAccessRevocationHandler | null>(null)

  const notifyLogoutActivity = useCallback(
    async (accessToken: string, reason: string) => {
      if (!accessToken || !apiBaseUrl) return

      const endpoint = `${apiBaseUrl.replace(/\/$/, '')}/activity`

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          keepalive: true,
          body: JSON.stringify({
            event: 'logout',
            metadata: { reason },
          }),
        })

        if (!response.ok) {
          const payload = await response.text().catch(() => null)
          console.warn('Failed to notify logout activity via auth provider', {
            status: response.status,
            body: payload,
          })
        }
      } catch (error) {
        console.error('Failed to notify logout activity via auth provider', error)
      }
    },
    [apiBaseUrl],
  )

  const enforceAccessRevocation = useCallback(
    async (targetSession: AuthContextValue['session'], detail?: AccessRevokedEventDetail) => {
      if (banHandledRef.current) {
        return
      }

      banHandledRef.current = true
      const banMetadata = getSessionBanMetadata(targetSession)
      const now = new Date().toISOString()
      const message =
        detail?.message ??
        'Seu acesso foi revogado. Caso acredite que isso seja um engano, fale com um administrador do CRM Heart.'

      persistAccessRevokedInfo({
        message,
        detail: detail?.detail ?? null,
        reason: detail?.reason ?? 'access_revoked',
        banReason: detail?.banReason ?? banMetadata.banReason ?? null,
        at: now,
      })

      lastSessionRef.current = null

      try {
        const accessToken =
          targetSession?.access_token ??
          (await supabase.auth
            .getSession()
            .then(({ data }) => data.session?.access_token)
            .catch((error) => {
              console.warn('Failed to load session before forced logout', error)
              return null
            }))

        if (accessToken) {
          void notifyLogoutActivity(accessToken, detail?.reason ?? 'access_revoked')
        }
      } catch (error) {
        console.warn('Failed to process logout activity before revogação de acesso', error)
      }

      try {
        await supabase.auth.signOut()
      } catch (error) {
        console.error('Failed to sign out after forced access revocation', error)
      }

      if (typeof window !== 'undefined') {
        window.location.replace('/auth/access-revoked')
      }
    },
    [notifyLogoutActivity],
  )

  useEffect(() => {
    let isMounted = true

    const getInitialSession = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (!isMounted) return

      if (error) {
        console.error('Failed to load session', error)
        setSession(null)
        lastSessionRef.current = null
        sessionSnapshotRef.current = null
      } else {
        setSession(data.session ?? null)
        lastSessionRef.current = data.session ?? null
        sessionSnapshotRef.current = data.session ?? null

        if (data.session && isSessionBanned(data.session)) {
          void enforceAccessRevocationRef.current?.(data.session, {
            reason: 'initial_session',
            banReason: getSessionBanMetadata(data.session).banReason,
          })
        }
      }

      setIsSessionLoading(false)
    }

    void getInitialSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      const previousSession = lastSessionRef.current
      setSession(nextSession)
      sessionSnapshotRef.current = nextSession ?? null

      if (nextSession && isSessionBanned(nextSession)) {
        void enforceAccessRevocationRef.current?.(nextSession, {
          reason: event ?? 'auth_state_change',
          banReason: getSessionBanMetadata(nextSession).banReason,
        })
      }

      if (!nextSession) {
        setProfile(null)
        setProfileError(null)
        geolocationRequestRef.current = false
      }

      if (!nextSession && previousSession?.access_token) {
        void notifyLogoutActivity(previousSession.access_token, event ?? 'auth_state_change')
      }

      lastSessionRef.current = nextSession ?? null
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [notifyLogoutActivity])

  const loadProfile = useCallback(async () => {
    if (!session?.user) {
      setProfile(null)
      setProfileError(null)
      setIsProfileLoading(false)
      return
    }

    setIsProfileLoading(true)
    setProfileError(null)
    const sessionUserId = session.user.id

    try {

      const mapProfile = (row: TeamMemberRow, schema: CompanySchema): UserProfile => {
        const metadata = row.metadata ?? {}
        const lastSession = (row.last_session as Record<string, unknown> | null) ?? null
        const sessionIp = (lastSession?.ip_address as string | null) ?? (metadata.ip_address as string | null) ?? null
        const sessionGeo =
          (lastSession?.geolocation as Record<string, unknown> | null) ??
          (metadata.geolocation as Record<string, unknown> | null) ??
          null
        return {
          id: row.id,
          company_id: row.company_id ?? null,
          user_name: row.user_name ?? null,
          user_email: row.user_email ?? session.user?.email ?? '',
          role: (row.role as UserRole | null) ?? null,
          last_session: lastSession,
          ip_address: sessionIp,
          geolocation: sessionGeo,
          status: row.status ?? null,
          last_activity: row.last_activity ?? null,
          created_at: row.created_at ?? null,
          updated_at: row.updated_at ?? null,
          schema,
        }
      }

      const schemaClients = profileSchemaPriority.map((schema) => ({
        name: schema,
        client: schema === 'heart' ? heartSupabase : coreSupabase,
        table: schema === 'heart' ? 'crm_user_profiles' : 'equipe',
        schema,
      }))

      let profileFound: UserProfile | null = null
      let hadBlockingError = false

      for (const schemaClient of schemaClients) {
        if (schemaBlacklistRef.current.has(schemaClient.name)) {
          continue
        }

        const { data, error, status } = await schemaClient.client
          .from(schemaClient.table)
          .select(selectColumns)
          .or(`id.eq.${sessionUserId},user_id.eq.${sessionUserId}`)
          .maybeSingle<TeamMemberRow>()

        if (error) {
          // 403 → RLS/permission denied, 404 → tabela não exposta. Apenas log informativo e segue para próximo schema.
          if (status === 403 || status === 404) {
            schemaBlacklistRef.current.add(schemaClient.name)
            const logKey = `${schemaClient.name}:${status}`
            if (!loggedSchemasRef.current.has(logKey)) {
              console.warn(`[${schemaClient.name}] Perfil não acessível (${status}). Ignorando schema.`)
              loggedSchemasRef.current.add(logKey)
            }
            continue
          }

          hadBlockingError = true
          console.error(`[${schemaClient.name}] Failed to load user profile`, error)
          continue
        }

        if (data) {
          profileFound = mapProfile(data, schemaClient.schema)
          break
        }
      }

      if (!profileFound && hadBlockingError) {
        setProfileError('Não foi possível carregar os dados do usuário.')
      } else {
        setProfileError(null)
      }

      setProfile(profileFound)
    } catch (error) {
      console.error('Unexpected error while loading profile', error)
      setProfileError('Erro inesperado ao carregar os dados do usuário.')
      setProfile(null)
    } finally {
      setIsProfileLoading(false)
    }
  }, [session?.user])

  useEffect(() => {
    schemaBlacklistRef.current.clear()
    loggedSchemasRef.current.clear()
  }, [session?.user?.id])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  useEffect(() => {
    sessionSnapshotRef.current = session
    if (session?.user?.id) {
      banHandledRef.current = false
    }
  }, [session])

  useEffect(() => {
    enforceAccessRevocationRef.current = enforceAccessRevocation
  }, [enforceAccessRevocation])

  useEffect(() => {
    const handleAccessRevokedEvent = (event: Event) => {
      const detail = event instanceof CustomEvent ? (event.detail as AccessRevokedEventDetail | undefined) : undefined
      if (sessionSnapshotRef.current) {
        void enforceAccessRevocationRef.current?.(sessionSnapshotRef.current, detail)
      }
    }

    window.addEventListener(ACCESS_REVOKED_EVENT, handleAccessRevokedEvent as EventListener)

    return () => {
      window.removeEventListener(ACCESS_REVOKED_EVENT, handleAccessRevokedEvent as EventListener)
    }
  }, [])

  useEffect(() => {
    if (!session?.user?.id) {
      return
    }

    const channel = supabase
      .channel(`activity:presence:${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'heart',
          table: 'equipe',
          filter: `id=eq.${session.user.id}`,
        },
        (payload) => {
          const nextStatus = (payload.new as { status?: string | null })?.status ?? null
          const nextLastActivity = (payload.new as { last_activity?: string | null })?.last_activity ?? null

          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  status: nextStatus,
                  last_activity: nextLastActivity,
                }
              : prev,
          )
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [session?.user?.id])

  useEffect(() => {
    const collectGeolocation = async () => {
      if (!session?.user || geolocationRequestRef.current) return
      // Sempre tenta atualizar para garantir que o metadata reflita a sessão atual.

      const accessToken =
        session?.access_token ??
        (await supabase.auth
          .getSession()
          .then(({ data }) => data.session?.access_token)
          .catch((error) => {
            console.error('Failed to load session before geolocation', error)
            return null
          }))

      if (!accessToken) {
        console.warn('Skipping geolocation update: missing access token')
        return
      }

      geolocationRequestRef.current = true

      const apiBaseUrl = env.apiUrl?.trim()

      if (!apiBaseUrl) {
        console.warn('Skipping geolocation update: backend API URL not configured.')
        geolocationRequestRef.current = false
        return
      }

      try {
        const endpoint = `${apiBaseUrl.replace(/\/$/, '')}/geolocation/collect`
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        })

        if (response.status === 401 || response.status === 403) {
          dispatchAccessRevokedEvent({
            reason: 'geolocation_collect',
            detail: 'geolocation.collect',
            message: 'Seu acesso foi revogado durante a atualização de localização.',
          })
          geolocationRequestRef.current = false
          return
        }

        if (!response.ok) {
          const errorPayload = await response.text().catch(() => null)
          console.error('Failed to collect geolocation', {
            status: response.status,
            body: errorPayload,
          })
          geolocationRequestRef.current = false
          return
        }

        await loadProfile()
      } catch (error) {
        console.error('Unexpected error when collecting geolocation', error)
        geolocationRequestRef.current = false
      }
    }

    if (profile) {
      void collectGeolocation()
    }
  }, [profile, session?.user, session?.access_token, loadProfile])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isLoading: isSessionLoading || isProfileLoading,
      isSessionLoading,
      isProfileLoading,
      profileError,
      refreshProfile: loadProfile,
    }),
    [session, profile, isSessionLoading, isProfileLoading, profileError, loadProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
