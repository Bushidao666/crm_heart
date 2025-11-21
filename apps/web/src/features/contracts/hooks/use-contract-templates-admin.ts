import { useCallback, useEffect, useState } from 'react'

import { coreSupabase, heartSupabase } from '@/lib/supabase-client'
import type { ContractTemplate, ContractTemplateVariable } from '@/features/contracts/types'

export const useContractTemplatesAdmin = () => {
  const [templates, setTemplates] = useState<(ContractTemplate & { variables: ContractTemplateVariable[] })[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const [
      { data: templatesData, error: templatesError },
      { data: variablesData, error: variablesError },
    ] = await Promise.all([
      heartSupabase.from('contract_templates').select('*').order('created_at', { ascending: false }),
      heartSupabase.from('contract_template_variables').select('*'),
    ])

    if (templatesError) {
      console.error('Failed to load contract templates', templatesError)
      setError('Não foi possível carregar os templates de contrato.')
      setTemplates([])
    } else if (variablesError) {
      console.error('Failed to load template variables', variablesError)
      setError('Não foi possível carregar as variáveis dos templates.')
      setTemplates([])
    } else {
      const variablesByTemplate = new Map<string, ContractTemplateVariable[]>()
      for (const rawVariable of variablesData ?? []) {
        const variable = rawVariable as ContractTemplateVariable
        const list = variablesByTemplate.get(variable.template_id) ?? []
        list.push(variable)
        variablesByTemplate.set(variable.template_id, list)
      }

      const templatesWithVariables = (templatesData ?? []).map((template) => {
        const casted = template as ContractTemplate
        return {
          ...casted,
          variables: [...(variablesByTemplate.get(casted.id) ?? [])],
        }
      })

      setTemplates(templatesWithVariables)
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    void fetchTemplates()
  }, [fetchTemplates])

  const saveTemplate = useCallback(
    async (
      payload: Partial<ContractTemplate> & {
        id?: string
        variables: Array<Omit<ContractTemplateVariable, 'id' | 'template_id' | 'created_at'> & { id?: string }>
      },
    ) => {
      if (!payload.nome || payload.nome.trim() === '') {
        throw new Error('Informe o nome do template.')
      }

      const corePayload = {
        id: payload.id,
        name: payload.nome.trim(),
        description: payload.descricao ?? null,
        active: payload.ativo ?? true,
      }

      const query = payload.id
        ? coreSupabase.from('contract_templates').update({
            name: corePayload.name,
            description: corePayload.description,
            active: corePayload.active,
          }).eq('id', payload.id).select('id').maybeSingle()
        : coreSupabase
            .from('contract_templates')
            .insert({
              name: corePayload.name,
              description: corePayload.description,
              active: corePayload.active,
              category: 'heart',
            })
            .select('id')
            .maybeSingle()

      const { data, error } = await query

      if (error || !data) {
        console.error('Failed to save contract template', error)
        throw new Error('Não foi possível salvar o template.')
      }

      const templateId = (data as ContractTemplate).id

      const { error: detailsError } = await heartSupabase
        .from('contract_template_details')
        .upsert(
          {
            template_id: templateId,
            storage_path: payload.storage_path ?? null,
            template_body: payload.template_body ?? null,
          },
          { onConflict: 'template_id' },
        )

      if (detailsError) {
        console.error('Failed to upsert template details', detailsError)
        throw new Error('Não foi possível salvar os metadados do template.')
      }

      const { error: deleteError } = await heartSupabase
        .from('contract_template_variables')
        .delete()
        .eq('template_id', templateId)

      if (deleteError) {
        console.error('Failed to reset template variables', deleteError)
        throw new Error('Não foi possível atualizar as variáveis do template.')
      }

      if (payload.variables.length > 0) {
        const insertPayload = payload.variables.map((variable) => ({
          template_id: templateId,
          variable_key: variable.variable_key,
          source: variable.source,
          column_name: variable.column_name ?? null,
        }))

        const { error: insertError } = await heartSupabase
          .from('contract_template_variables')
          .insert(insertPayload)

        if (insertError) {
          console.error('Failed to insert template variables', insertError)
          throw new Error('Não foi possível salvar as variáveis do template.')
        }
      }

      await fetchTemplates()
    },
    [fetchTemplates],
  )

  const toggleTemplateStatus = useCallback(async (id: string, active: boolean) => {
    const { error } = await coreSupabase.from('contract_templates').update({ active }).eq('id', id)

    if (error) {
      console.error('Failed to toggle contract template status', error)
      throw new Error('Não foi possível atualizar o status do template.')
    }

    setTemplates((current) => current.map((template) => (template.id === id ? { ...template, ativo: active } : template)))
  }, [])

  const deleteTemplate = useCallback(
    async (id: string) => {
      const { error } = await coreSupabase.from('contract_templates').delete().eq('id', id)

      if (error) {
        console.error('Failed to delete contract template', error)
        throw new Error('Não foi possível excluir o template.')
      }

      setTemplates((current) => current.filter((template) => template.id !== id))
    },
    [],
  )

  return {
    templates,
    isLoading,
    error,
    saveTemplate,
    deleteTemplate,
    refresh: fetchTemplates,
    toggleTemplateStatus,
  }
}
