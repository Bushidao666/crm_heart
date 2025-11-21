import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { heartSupabase, supabase } from '@/lib/supabase-client'
import type { InviteMemberPayload, TeamMember } from '@/features/team/types'
import { env } from '@/config/env'
import { dispatchAccessRevokedEvent } from '@/features/auth/utils/access-revoked'

export type TeamInviteResult = {
  ok: boolean
  message?: string
  credentials?: {
    name: string
    email: string
    password: string
    role: string
  }
}

export const useTeamManagement = () => {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isInviting, setIsInviting] = useState(false)
  const [isBlacklisting, setIsBlacklisting] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isRestoring, setIsRestoring] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inviteMessage, setInviteMessage] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const refreshDebounceRef = useRef<number | null>(null)
  const apiBaseUrl = env.apiUrl?.trim()

  const fetchMembers = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: queryError } = await heartSupabase
        .from('equipe')
        .select(`id, user_name, user_email, role, status, last_activity, metadata, last_session, created_at, updated_at`)
        .order('created_at', { ascending: false })

      if (queryError) {
        console.error('Failed to load team members', queryError)
        setError('Não foi possível carregar a equipe no momento.')
        return
      }

      setMembers(data ?? [])
    } catch (error) {
      console.error('Unexpected error while loading team members', error)
      setError('Erro inesperado ao carregar a equipe.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchMembers()
  }, [fetchMembers])

  const requestTeamApi = useCallback(
    async (path: string, payload: Record<string, unknown>): Promise<unknown> => {
      if (!apiBaseUrl) {
        throw new Error('Backend API URL não configurada.')
      }

      const token = await supabase.auth
        .getSession()
        .then(({ data }) => data.session?.access_token)
        .catch(() => null)

      if (!token) {
        throw new Error('Sessão inválida. Faça login novamente.')
      }

      const endpoint = `${apiBaseUrl.replace(/\/$/, '')}${path}`
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.status === 401 || response.status === 403) {
        dispatchAccessRevokedEvent({
          reason: 'team_api',
          detail: path,
          message: 'Seu acesso foi revogado. Faça login novamente.',
        })
        throw new Error('Acesso revogado. Faça login novamente.')
      }

      if (!response.ok) {
        const payloadText = await response.text().catch(() => null)
        const errorMessage = payloadText && payloadText.trim().length > 0 ? payloadText : null
        throw new Error(errorMessage ?? `Falha na solicitação (${response.status}).`)
      }

      if (response.headers.get('content-type')?.includes('application/json')) {
        return response.json()
      }

      return undefined
    },
    [apiBaseUrl],
  )

  useEffect(() => {
    const channel = supabase
      .channel('team-management:equipe')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'heart',
          table: 'equipe',
        },
        () => {
          if (refreshDebounceRef.current) return

          refreshDebounceRef.current = window.setTimeout(() => {
            refreshDebounceRef.current = null
            void fetchMembers()
          }, 1_000)
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          return
        }
      })

    return () => {
      if (refreshDebounceRef.current) {
        window.clearTimeout(refreshDebounceRef.current)
        refreshDebounceRef.current = null
      }
      void supabase.removeChannel(channel)
    }
  }, [fetchMembers])

  const inviteMember = useCallback(
    async ({ name, email, role }: InviteMemberPayload): Promise<TeamInviteResult> => {
      setIsInviting(true)
      setError(null)
      setInviteMessage(null)

      try {
        const response = (await requestTeamApi('/team/invite', { name, email, role })) as
          | { success: boolean; credentials?: { name: string; email: string; password: string; role: string } }
          | undefined

        setInviteMessage('Usuário criado com sucesso!')
        await fetchMembers()
        return { ok: true, credentials: response?.credentials }
      } catch (error) {
        console.error('Unexpected error while inviting member', error)
        const message = error instanceof Error ? error.message : 'Erro inesperado ao cadastrar o usuário.'
        setError(message)
        return { ok: false, message }
      } finally {
        setIsInviting(false)
      }
    },
    [fetchMembers, requestTeamApi],
  )

  const blacklistMember = useCallback(
    async (memberId: string) => {
      setIsBlacklisting(memberId)
      setError(null)
      setActionMessage(null)

      try {
        await requestTeamApi('/team/blacklist', { userId: memberId })

        setActionMessage('Usuário movido para a blacklist com sucesso.')
        await fetchMembers()
        return { ok: true as const }
      } catch (error) {
        console.error('Unexpected error while blacklisting member', error)
        setError(error instanceof Error ? error.message : 'Erro inesperado ao atualizar o usuário.')
        return { ok: false as const }
      } finally {
        setIsBlacklisting(null)
      }
    },
    [fetchMembers, requestTeamApi],
  )

  const deleteMember = useCallback(
    async (memberId: string) => {
      setIsDeleting(memberId)
      setError(null)
      setActionMessage(null)

      try {
        await requestTeamApi('/team/delete', { userId: memberId })

        setActionMessage('Usuário excluído com sucesso.')
        await fetchMembers()
        return { ok: true as const }
      } catch (error) {
        console.error('Unexpected error while deleting member', error)
        setError(error instanceof Error ? error.message : 'Erro inesperado ao excluir o usuário.')
        return { ok: false as const }
      } finally {
        setIsDeleting(null)
      }
    },
    [fetchMembers, requestTeamApi],
  )

  const restoreMember = useCallback(
    async (memberId: string) => {
      setIsRestoring(memberId)
      setError(null)
      setActionMessage(null)

      try {
        await requestTeamApi('/team/restore', { userId: memberId })
        setActionMessage('Acesso restaurado com sucesso.')
        await fetchMembers()
        return { ok: true as const }
      } catch (error) {
        console.error('Unexpected error while restoring member', error)
        setError(error instanceof Error ? error.message : 'Erro inesperado ao restaurar o usuário.')
        return { ok: false as const }
      } finally {
        setIsRestoring(null)
      }
    },
    [fetchMembers, requestTeamApi],
  )

  const value = useMemo(
    () => ({
      members,
      isLoading,
      isInviting,
      isBlacklisting,
      isDeleting,
      isRestoring,
      error,
      inviteMessage,
      actionMessage,
      inviteMember,
      blacklistMember,
      deleteMember,
      restoreMember,
      refresh: fetchMembers,
    }),
    [
      members,
      isLoading,
      isInviting,
      isBlacklisting,
      isDeleting,
      isRestoring,
      error,
      inviteMessage,
      actionMessage,
      inviteMember,
      blacklistMember,
      deleteMember,
      restoreMember,
      fetchMembers,
    ],
  )

  return value
}
