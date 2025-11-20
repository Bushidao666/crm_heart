import { useEffect, useState } from 'react'

import { heartSupabase } from '@/lib/supabase-client'
import type { ContractTemplateWithVariables, ContractTemplateVariable } from '@/features/contracts/types'

export const useContractTemplates = () => {
  const [templates, setTemplates] = useState<ContractTemplateWithVariables[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTemplates = async () => {
      setIsLoading(true)
      setError(null)

      const [
        { data: templatesData, error: templatesError },
        { data: variablesData, error: variablesError },
      ] = await Promise.all([
        heartSupabase.from('contract_templates').select('*').eq('ativo', true).order('created_at', { ascending: false }),
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

        const merged = (templatesData ?? []).map((template) => {
          const casted = template as ContractTemplateWithVariables
          return {
            ...casted,
            variables: [...(variablesByTemplate.get(casted.id) ?? [])],
          }
        })
        setTemplates(merged)
      }

      setIsLoading(false)
    }

    void fetchTemplates()
  }, [])

  return { templates, isLoading, error }
}
