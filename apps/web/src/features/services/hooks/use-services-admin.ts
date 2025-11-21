import { useCallback, useEffect, useState } from 'react'

import { useCompany } from '@/app/providers/use-company'
import { heartSupabase } from '@/lib/supabase-client'
import type { ContractTemplateRecord, ServiceRecord } from '@/features/services/types'

export const useServicesAdmin = () => {
  const [services, setServices] = useState<ServiceRecord[]>([])
  const [templates, setTemplates] = useState<ContractTemplateRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { companyId, isLoading: isCompanyLoading, error: companyError } = useCompany()

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    if (!companyId) {
      if (!isCompanyLoading) {
        setError(companyError ?? 'Sua conta não está vinculada a nenhuma empresa.')
      }
      setServices([])
      setTemplates([])
      setIsLoading(false)
      return
    }

    const servicesQuery = heartSupabase
      .from('services')
      .select('*')
      .or(`company_id.eq.${companyId},company_id.is.null`)
      .order('created_at', { ascending: false })

    const templatesQuery = heartSupabase
      .from('contract_templates')
      .select('id, nome, descricao, ativo')
      .eq('ativo', true)
      .order('created_at', { ascending: false })

    const [{ data: servicesData, error: servicesError }, { data: templatesData, error: templatesError }] = await Promise.all([
      servicesQuery,
      templatesQuery,
    ])

    if (servicesError) {
      console.error('Failed to load services', servicesError)
      setError('Não foi possível carregar os serviços.')
    } else {
      setServices((servicesData ?? []) as ServiceRecord[])
    }

    if (templatesError) {
      console.warn('Failed to load contract templates', templatesError)
    } else {
      setTemplates((templatesData ?? []) as ContractTemplateRecord[])
    }

    setIsLoading(false)
  }, [companyId, companyError, isCompanyLoading])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const createOrUpdateService = useCallback(
    async (payload: Partial<ServiceRecord> & { id?: string }) => {
      if (!companyId) {
        throw new Error('Sua conta não está vinculada a nenhuma empresa.')
      }

      if (!payload.nome || payload.nome.trim() === '') {
        throw new Error('Informe o nome do serviço.')
      }

      const upsertPayload = {
        id: payload.id,
        nome: payload.nome,
        descricao: payload.descricao ?? null,
        valor_padrao: payload.valor_padrao ?? 0,
        max_parcelas: payload.max_parcelas ?? 1,
        formas_pagamento: payload.formas_pagamento ?? [],
        contrato_template_id: payload.contrato_template_id ?? null,
        company_id: payload.company_id ?? companyId,
      }

      const query = payload.id
        ? heartSupabase.from('services').update(upsertPayload).eq('id', payload.id).eq('company_id', companyId).select().maybeSingle()
        : heartSupabase.from('services').insert(upsertPayload).select().maybeSingle()

      const { data, error } = await query

      if (error) {
        console.error('Failed to save service', error)
        throw new Error('Não foi possível salvar o serviço.')
      }

      if (!data) {
        throw new Error('Resposta inválida do servidor.')
      }

      setServices((current) => {
        const existingIndex = current.findIndex((item) => item.id === data.id)
        if (existingIndex >= 0) {
          const copy = [...current]
          copy[existingIndex] = data as ServiceRecord
          return copy
        }

        return [data as ServiceRecord, ...current]
      })
    },
    [companyId],
  )

  const deleteService = useCallback(async (id: string) => {
    if (!companyId) {
      throw new Error('Sua conta não está vinculada a nenhuma empresa.')
    }

    const { error } = await heartSupabase.from('services').delete().eq('id', id).eq('company_id', companyId)

    if (error) {
      console.error('Failed to delete service', error)
      throw new Error('Não foi possível excluir o serviço.')
    }

    setServices((current) => current.filter((service) => service.id !== id))
  }, [companyId])

  return {
    services,
    templates,
    isLoading,
    error,
    refresh: fetchData,
    createOrUpdateService,
    deleteService,
  }
}
