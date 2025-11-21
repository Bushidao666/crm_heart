import { useCallback, useEffect, useMemo, useState } from 'react'

import { useCompany } from '@/app/providers/use-company'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { heartSupabase, supabase } from '@/lib/supabase-client'
import { env } from '@/config/env'
import type { LeadRecord, LeadStatus } from '@/features/leads/types'

export type LeadsByStatus = Record<LeadStatus, LeadRecord[]>

const initialState: LeadsByStatus = {
  lead_novo: [],
  em_atendimento: [],
  descartado: [],
  convertido: [],
}

type FetchOpts = {
  searchTerm?: string
  startDate?: string | null
  endDate?: string | null
  ownerId?: string | null
}

const buildQuery = (
  filters: { companyId?: string | null; ownerId?: string | null },
  { searchTerm, startDate, endDate, ownerId }: FetchOpts,
) => {
  let query = heartSupabase
    .from('leads_captura')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters.companyId) {
    query = query.eq('company_id', filters.companyId)
  } else if (filters.ownerId) {
    query = query.eq('vendedor_responsavel', filters.ownerId)
  }

  const effectiveOwnerId = ownerId ?? filters.ownerId
  if (effectiveOwnerId) {
    query = query.eq('vendedor_responsavel', effectiveOwnerId)
  }

  if (searchTerm) {
    const term = searchTerm.trim()
    query = query.or(
      `lead_first_name.ilike.%${term}%,lead_last_name.ilike.%${term}%,lead_email.ilike.%${term}%,lead_phone.ilike.%${term}%`,
    )
  }

  if (startDate) {
    query = query.gte('created_at', startDate)
  }

  if (endDate) {
    query = query.lte('created_at', endDate)
  }

  return query
}

type CreateLeadPayload = {
  firstName: string
  lastName?: string
  email?: string
  phone?: string
}

export const useLeadsKanban = () => {
  const [leads, setLeads] = useState<LeadRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { companyId, isLoading: isCompanyLoading, error: companyError } = useCompany()
  const { user } = useAuth()
  const userId = user?.id ?? null
  const apiBaseUrl = env.apiUrl?.trim() ?? ''

  const requestLeadsApi = useCallback(
    async (path: string, payload: Record<string, unknown>) => {
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
      console.log('[requestLeadsApi] calling', endpoint, 'payload:', payload)
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      console.log('[requestLeadsApi] status', response.status, 'for', endpoint)
      if (response.status === 401 || response.status === 403) {
        throw new Error('Seu acesso foi revogado. Faça login novamente.')
      }

      if (!response.ok) {
        const payloadText = await response.text().catch(() => null)
        console.error('[requestLeadsApi] backend error body:', payloadText)
        throw new Error(payloadText || 'Falha ao processar solicitação.')
      }

      const parsed = await response
        .json()
        .then((body) => body)
        .catch(() => null)

      if (!parsed) {
        throw new Error('Resposta inválida do backend.')
      }

      return parsed
    },
    [apiBaseUrl],
  )

  const fetchLeads = useCallback(
    async (options: FetchOpts = {}) => {
      setIsLoading(true)
      setError(null)

      const fallbackOwnerId = !companyId ? userId : null

      if (!companyId && !fallbackOwnerId) {
        if (!isCompanyLoading) {
          setError(companyError ?? 'Sua conta não está vinculada a nenhuma empresa.')
        }
        setLeads([])
        setIsLoading(false)
        return
      }

      const query = buildQuery(
        {
          companyId: companyId ?? null,
          ownerId: fallbackOwnerId,
        },
        options,
      )
      const { data, error: fetchError } = await query

      if (fetchError) {
        console.error('Failed to load leads', fetchError)
        setError('Não foi possível carregar os leads.')
        setLeads([])
      } else {
        setLeads((data ?? []) as LeadRecord[])
      }

      setIsLoading(false)
    },
    [companyId, companyError, isCompanyLoading, userId],
  )

  const updateLeadStatus = useCallback(
    async (leadId: string, status: LeadStatus, motivo?: string | null) => {
      if (!companyId) {
        throw new Error('Sua conta não está vinculada a nenhuma empresa.')
      }

      if (status === 'convertido') {
        const { error: rpcError } = await heartSupabase.rpc('convert_lead_to_deal', { p_lead_id: leadId })

        if (rpcError) {
          console.error('Failed to convert lead to deal', rpcError)
          throw new Error('Não foi possível converter o lead em negócio.')
        }

        setLeads((current) =>
          current.map((lead) => (lead.id === leadId ? { ...lead, lead_status: 'convertido' } : lead)),
        )
        return
      }

      const { data, error: updateError } = await heartSupabase
        .from('leads_captura')
        .update({ lead_status: status, motivo_descarte: motivo ?? null })
        .eq('id', leadId)
        .eq('company_id', companyId)
        .select()
        .maybeSingle()

      if (updateError) {
        console.error('Failed to update lead status', updateError)
        throw new Error('Não foi possível atualizar o lead. Tente novamente.')
      }

      if (!data) {
        throw new Error('Lead não encontrado.')
      }

      setLeads((current) => current.map((lead) => (lead.id === leadId ? (data as LeadRecord) : lead)))
    },
    [companyId],
  )

  const deleteLead = useCallback(
    async (leadId: string) => {
      if (!companyId) {
        throw new Error('Sua conta não está vinculada a nenhuma empresa.')
      }

      const { error: deleteError } = await heartSupabase
        .from('leads_captura')
        .delete()
        .eq('id', leadId)
        .eq('company_id', companyId)

      if (deleteError) {
        console.error('Failed to delete lead', deleteError)
        throw new Error('Não foi possível excluir o lead. Tente novamente.')
      }

      setLeads((current) => current.filter((lead) => lead.id !== leadId))
    },
    [companyId],
  )

  const createLead = useCallback(
    async ({ firstName, lastName, email, phone }: CreateLeadPayload) => {
      if (!companyId) {
        throw new Error('Sua conta não está vinculada a nenhuma empresa.')
      }

      if (!firstName.trim()) {
        throw new Error('Informe ao menos o primeiro nome do lead.')
      }

      const insertPayload = {
        company_id: companyId,
        lead_first_name: firstName.trim(),
        lead_last_name: lastName?.trim() || null,
        lead_email: email?.trim() || null,
        lead_phone: phone?.trim() || null,
        lead_status: 'lead_novo' as LeadStatus,
        vendedor_responsavel: userId,
      }

      const { data, error: insertError } = await heartSupabase
        .from('leads_captura')
        .insert(insertPayload)
        .select()
        .maybeSingle()

      if (insertError || !data) {
        console.error('Failed to create lead', insertError)
        throw new Error('Não foi possível criar o lead. Tente novamente.')
      }

      setLeads((current) => [data as LeadRecord, ...current])
      return data as LeadRecord
    },
    [companyId, userId],
  )

  const transferLeadOwner = useCallback(
    async (leadId: string, _targetCompanyId: string | null, newOwnerId: string) => {
      void _targetCompanyId
      const usingBackend = Boolean(apiBaseUrl)

      console.log('[transferLeadOwner] VITE_API_URL =', apiBaseUrl || '(não configurada)')
      console.log('[transferLeadOwner] usingBackend =', usingBackend)

      if (!usingBackend) {
        console.error('[transferLeadOwner] API do backend indisponível. Operação bloqueada.')
        throw new Error('API do backend indisponível. Configure VITE_API_URL para transferir leads.')
      }

      try {
        console.log('[transferLeadOwner] calling backend transfer-owner', {
          leadId,
          newOwnerId,
        })

        const response = (await requestLeadsApi('/leads/transfer-owner', {
          leadId,
          newOwnerId,
        })) as {
          lead: LeadRecord
        }

        if (!response?.lead) {
          throw new Error('Resposta do backend não contém o lead atualizado.')
        }

        console.log('[transferLeadOwner] backend returned lead', response.lead.id)
        const updatedLead = response.lead
        setLeads((current) => current.map((lead) => (lead.id === leadId ? updatedLead : lead)))
        return updatedLead
      } catch (err) {
        console.error('[transferLeadOwner] erro geral:', err)
        throw err
      }
    },
    [apiBaseUrl, requestLeadsApi],
  )

  const leadsByStatus = useMemo(() => {
    return leads.reduce<LeadsByStatus>((acc, lead) => {
      if (!acc[lead.lead_status]) {
        acc[lead.lead_status] = []
      }
      acc[lead.lead_status].push(lead)
      return acc
    }, structuredClone(initialState))
  }, [leads])

  useEffect(() => {
    const fallbackOwnerId = !companyId ? userId : null
    if (!companyId && !fallbackOwnerId) return

    const channel = supabase
      .channel(`heart:leads_captura:${companyId ?? fallbackOwnerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'heart',
          table: 'leads_captura',
          filter: companyId ? `company_id=eq.${companyId}` : `vendedor_responsavel=eq.${fallbackOwnerId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE' && payload.old?.id) {
            setLeads((current) => current.filter((lead) => lead.id !== payload.old?.id))
            return
          }

          if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
            const updatedLead = payload.new as LeadRecord
            setLeads((current) => {
              const next = current.filter((lead) => lead.id !== updatedLead.id)
              next.unshift(updatedLead)
              return next
            })
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [companyId, userId])

  return {
    leads,
    leadsByStatus,
    isLoading,
    error,
    fetchLeads,
    updateLeadStatus,
    deleteLead,
    createLead,
    transferLeadOwner,
  }
}
