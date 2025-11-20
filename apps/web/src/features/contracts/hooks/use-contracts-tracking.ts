import { useCallback, useEffect, useState } from 'react'

import { useCompany } from '@/app/providers/use-company'
import { heartSupabase } from '@/lib/supabase-client'

export type ContractStatusFilter = 'todos' | 'contrato_enviado' | 'contrato_assinado' | 'contrato_rejeitado'

export type ContractRecord = {
  id: string
  contrato_nome: string | null
  contrato_status: string | null
  contrato_metodo: string | null
  document_id_autentique: string | null
  contrato_copia: string | null
  contrato_copia_path: string | null
  deal_id: string | null
  deal_name: string | null
  deal_email: string | null
  deal_phone: string | null
  deal_cpf: string | null
  vendedor_responsavel: string | null
  updated_at: string
  created_at: string
}

type ContractRowResponse = {
  id: string
  contrato_nome: string | null
  contrato_status: string | null
  contrato_metodo: string | null
  document_id_autentique: string | null
  contrato_copia: string | null
  contrato_copia_path: string | null
  deal_id: string | null
  vendedor_responsavel: string | null
  updated_at: string
  created_at: string
  deal: {
    deal_full_name: string | null
    deal_email: string | null
    deal_phone: string | null
    deal_cpf: string | null
    vendedor_responsavel: string | null
  } | null
}

type FetchOptions = {
  status?: ContractStatusFilter
  startDate?: string | null
  endDate?: string | null
  search?: string
}

export const useContractsTracking = (userId: string | null, isAdmin: boolean) => {
  const [contracts, setContracts] = useState<ContractRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { companyId, isLoading: isCompanyLoading, error: companyError } = useCompany()

  const fetchContracts = useCallback(
    async ({ status, startDate, endDate, search }: FetchOptions = {}) => {
      setIsLoading(true)
      setError(null)

      if (!companyId) {
        if (!isCompanyLoading) {
          setError(companyError ?? 'Sua conta não está vinculada a nenhuma empresa.')
        }
        setContracts([])
        setIsLoading(false)
        return
      }

      let query = heartSupabase
        .from('contratos')
        .select(
          `*,
          deal:deals!left(id, deal_full_name, deal_email, deal_phone, deal_cpf, vendedor_responsavel)`
        )
        .eq('company_id', companyId)
        .order('updated_at', { ascending: false })

      if (!isAdmin && userId) {
        query = query.eq('vendedor_responsavel', userId)
      }

      if (status && status !== 'todos') {
        query = query.eq('contrato_status', status)
      }

      if (startDate) {
        query = query.gte('updated_at', startDate)
      }

      if (endDate) {
        query = query.lte('updated_at', endDate)
      }

      const normalizedSearch = search?.trim().toLowerCase() ?? ''
      const normalizedDigits = normalizedSearch.replace(/\D/g, '')

      const { data, error } = await query

      if (error) {
        console.error('Failed to load contracts', error)
        setError('Não foi possível carregar os contratos.')
        setContracts([])
      } else {
        const rows = (data ?? []) as ContractRowResponse[]
        const mapped = rows.map<ContractRecord>((item) => ({
          id: item.id,
          contrato_nome: item.contrato_nome,
          contrato_status: item.contrato_status,
          contrato_metodo: item.contrato_metodo,
          document_id_autentique: item.document_id_autentique,
          contrato_copia: item.contrato_copia,
          contrato_copia_path: item.contrato_copia_path ?? null,
          deal_id: item.deal_id,
          deal_name: item.deal?.deal_full_name ?? null,
          deal_email: item.deal?.deal_email ?? null,
          deal_phone: item.deal?.deal_phone ?? null,
          deal_cpf: item.deal?.deal_cpf ?? null,
          vendedor_responsavel: item.vendedor_responsavel,
          updated_at: item.updated_at,
          created_at: item.created_at,
        }))

        const filtered = normalizedSearch
          ? mapped.filter((item) => {
              const candidateStrings = [
                item.contrato_nome,
                item.document_id_autentique,
                item.deal_name,
                item.deal_email,
                item.deal_phone,
                item.deal_cpf,
              ]
                .filter(Boolean)
                .map((value) => value!.toLowerCase())

              const candidateDigits = [
                item.deal_phone ? item.deal_phone.replace(/\D/g, '') : null,
                item.deal_cpf ? item.deal_cpf.replace(/\D/g, '') : null,
              ].filter(Boolean) as string[]

              const matchesString = candidateStrings.some((value) => value.includes(normalizedSearch))
              const matchesDigits =
                normalizedDigits.length > 0 ? candidateDigits.some((value) => value.includes(normalizedDigits)) : false

              return matchesString || matchesDigits
            })
          : mapped

        setContracts(filtered)
      }

      setIsLoading(false)
    },
    [companyError, companyId, isAdmin, isCompanyLoading, userId],
  )

  useEffect(() => {
    void fetchContracts()
  }, [fetchContracts])

  return { contracts, isLoading, error, fetchContracts }
}
