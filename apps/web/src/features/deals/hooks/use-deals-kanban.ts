import { useCallback, useEffect, useMemo, useState } from 'react'

import { formatInTimeZone } from 'date-fns-tz'

import { useCompany } from '@/app/providers/use-company'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { heartSupabase, supabase } from '@/lib/supabase-client'
import type { DealRecord, DealStatus } from '@/features/deals/types'

export type DealsByStatus = Record<DealStatus, DealRecord[]>

const initialState: DealsByStatus = {
  negocio_novo: [],
  contrato_enviado: [],
  contrato_assinado: [],
  contrato_rejeitado: [],
}

type FetchOpts = {
  searchTerm?: string
  dateRange?: { start: string | null; end: string | null }
  ownerId?: string | null
}

const buildQuery = (companyId: string, { searchTerm, dateRange, ownerId }: FetchOpts) => {
  let query = heartSupabase
    .from('deals')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  const trimmed = searchTerm?.trim()
  if (trimmed) {
    query = query.or(
      `deal_full_name.ilike.%${trimmed}%,deal_email.ilike.%${trimmed}%,deal_phone.ilike.%${trimmed}%,deal_cpf.ilike.%${trimmed}%`,
    )
  }

  if (dateRange?.start) {
    query = query.gte('created_at', dateRange.start)
  }

  if (dateRange?.end) {
    query = query.lte('created_at', dateRange.end)
  }

  if (ownerId) {
    query = query.eq('vendedor_responsavel', ownerId)
  }

  return query
}

export const useDealsKanban = () => {
  const [deals, setDeals] = useState<DealRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { companyId, isLoading: isCompanyLoading, error: companyError } = useCompany()
  const { user } = useAuth()

  const getBrazilTimestamp = useCallback(() => {
    return formatInTimeZone(new Date(), 'America/Sao_Paulo', "yyyy-MM-dd'T'HH:mm:ssXXX")
  }, [])

  const fetchDeals = useCallback(
    async (options: FetchOpts = {}) => {
      setIsLoading(true)
      setError(null)

      if (!companyId) {
        if (!isCompanyLoading) {
          setError(companyError ?? 'Sua conta não está vinculada a nenhuma empresa.')
        }
        setDeals([])
        setIsLoading(false)
        return
      }

      const { data, error: fetchError } = await buildQuery(companyId, options)

      if (fetchError) {
        console.error('Failed to load deals', fetchError)
        setError('Não foi possível carregar os negócios.')
        setDeals([])
      } else {
        setDeals((data ?? []) as DealRecord[])
      }

      setIsLoading(false)
    },
    [companyId, companyError, isCompanyLoading],
  )

  const updateDealStatus = useCallback(
    async (dealId: string, status: DealStatus) => {
      if (!companyId) {
        throw new Error('Sua conta não está vinculada a nenhuma empresa.')
      }

      const { data, error: updateError } = await heartSupabase
        .from('deals')
        .update({ deal_status: status, updated_at: getBrazilTimestamp() })
        .eq('id', dealId)
        .eq('company_id', companyId)
        .select()
        .maybeSingle()

      if (updateError) {
        console.error('Failed to update deal status', updateError)
        throw new Error('Não foi possível atualizar o negócio.')
      }

      if (!data) {
        throw new Error('Negócio não encontrado.')
      }

      setDeals((current) => current.map((deal) => (deal.id === dealId ? (data as DealRecord) : deal)))
    },
    [companyId, getBrazilTimestamp],
  )

  const createDeal = useCallback(
    async (payload: Partial<DealRecord> & { id?: string }) => {
      if (!companyId) {
        throw new Error('Sua conta não está vinculada a nenhuma empresa.')
      }

      const vendedorResponsavel = payload.vendedor_responsavel ?? user?.id ?? null
      if (!vendedorResponsavel) {
        throw new Error('Não foi possível identificar o vendedor responsável para criar o negócio.')
      }

      const timestamp = getBrazilTimestamp()
      const insertPayload = {
        ...payload,
        company_id: payload.company_id ?? companyId,
        deal_status: payload.deal_status ?? 'negocio_novo',
        created_at: payload.created_at ?? timestamp,
        updated_at: payload.updated_at ?? timestamp,
        vendedor_responsavel: vendedorResponsavel,
      }

      const { data, error: insertError } = await heartSupabase
        .from('deals')
        .insert(insertPayload)
        .select()
        .maybeSingle()

      if (insertError) {
        console.error('Failed to create deal', insertError)
        throw new Error('Não foi possível criar o negócio.')
      }

      if (!data) {
        throw new Error('Não foi possível criar o negócio.')
      }

      const insertedDeal = data as DealRecord

      setDeals((current) => {
        const next = current.filter((deal) => deal.id !== insertedDeal.id)
        next.unshift(insertedDeal)
        return next
      })

      return insertedDeal
    },
    [companyId, getBrazilTimestamp, user?.id],
  )

  const upsertDeal = useCallback(
    async (payload: Partial<DealRecord> & { id: string }) => {
      if (!companyId) {
        throw new Error('Sua conta não está vinculada a nenhuma empresa.')
      }

      const { data, error: upsertError } = await heartSupabase
        .from('deals')
        .update({ ...payload, company_id: payload.company_id ?? companyId, updated_at: getBrazilTimestamp() })
        .eq('id', payload.id)
        .eq('company_id', companyId)
        .select()
        .maybeSingle()

      if (upsertError) {
        console.error('Failed to update deal', upsertError)
        throw new Error('Não foi possível salvar o negócio.')
      }

      if (!data) {
        return createDeal(payload)
      }

      setDeals((current) => current.map((deal) => (deal.id === payload.id ? (data as DealRecord) : deal)))

      return data as DealRecord
    },
    [companyId, createDeal, getBrazilTimestamp],
  )

  const deleteDeal = useCallback(
    async (dealId: string) => {
      if (!companyId) {
        throw new Error('Sua conta não está vinculada a nenhuma empresa.')
      }

      const { error: deleteError } = await heartSupabase.from('deals').delete().eq('id', dealId).eq('company_id', companyId)

      if (deleteError) {
        console.error('Failed to delete deal', deleteError)
        throw new Error('Não foi possível excluir o negócio.')
      }

      setDeals((current) => current.filter((deal) => deal.id !== dealId))
    },
    [companyId],
  )

  const dealsByStatus = useMemo(() => {
    return deals.reduce<DealsByStatus>((acc, deal) => {
      acc[deal.deal_status]?.push(deal)
      return acc
    }, structuredClone(initialState))
  }, [deals])

  useEffect(() => {
    if (!companyId) return

    const channel = supabase
      .channel(`heart:deals:${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'heart',
          table: 'deals',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE' && payload.old?.id) {
            setDeals((current) => current.filter((deal) => deal.id !== payload.old?.id))
            return
          }

          if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
            const updatedDeal = payload.new as DealRecord
            setDeals((current) => {
              const next = current.filter((deal) => deal.id !== updatedDeal.id)
              next.unshift(updatedDeal)
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
    deals,
    dealsByStatus,
    isLoading,
    error,
    fetchDeals,
    updateDealStatus,
    createDeal,
    upsertDeal,
    deleteDeal,
  }
}
