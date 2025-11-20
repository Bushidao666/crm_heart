import { useCallback, useEffect, useMemo, useState } from 'react'

import { useCompany } from '@/app/providers/use-company'
import { heartSupabase, supabase } from '@/lib/supabase-client'
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
}

const buildQuery = (companyId: string, { searchTerm, startDate, endDate }: FetchOpts) => {
  let query = heartSupabase
    .from('leads_captura')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

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

  const fetchLeads = useCallback(
    async (options: FetchOpts = {}) => {
      setIsLoading(true)
      setError(null)

      if (!companyId) {
        if (!isCompanyLoading) {
          setError(companyError ?? 'Sua conta não está vinculada a nenhuma empresa.')
        }
        setLeads([])
        setIsLoading(false)
        return
      }

      const query = buildQuery(companyId, options)
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
    [companyId, companyError, isCompanyLoading],
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
    [companyId],
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
    if (!companyId) return

    const channel = supabase
      .channel(`heart:leads_captura:${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'heart',
          table: 'leads_captura',
          filter: `company_id=eq.${companyId}`,
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
  }, [companyId])

  return {
    leads,
    leadsByStatus,
    isLoading,
    error,
    fetchLeads,
    updateLeadStatus,
    deleteLead,
    createLead,
  }
}
