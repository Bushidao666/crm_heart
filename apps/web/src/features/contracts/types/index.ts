type VariableSource = 'lead' | 'deal' | 'custom'

export type ContractTemplate = {
  id: string
  nome: string
  descricao: string | null
  storage_path: string | null
  template_body: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export type ContractTemplateVariable = {
  id: string
  template_id: string
  variable_key: string
  source: VariableSource
  column_name: string | null
  created_at: string
}

export type ContractTemplateWithVariables = ContractTemplate & {
  variables: ContractTemplateVariable[]
}

export type VariableOption = {
  label: string
  value: string
  source: VariableSource
  column: string
}

export const DEAL_VARIABLES: VariableOption[] = [
  { label: 'Nome completo', value: '{{deal_full_name}}', source: 'deal', column: 'deal_full_name' },
  { label: 'Email', value: '{{deal_email}}', source: 'deal', column: 'deal_email' },
  { label: 'CPF', value: '{{deal_cpf}}', source: 'deal', column: 'deal_cpf' },
  { label: 'Telefone', value: '{{deal_phone}}', source: 'deal', column: 'deal_phone' },
  { label: 'Valor contrato', value: '{{deal_valor_contrato}}', source: 'deal', column: 'deal_valor_contrato' },
  { label: 'Forma pagamento', value: '{{deal_forma_pagamento}}', source: 'deal', column: 'deal_forma_pagamento' },
]

export const LEAD_VARIABLES: VariableOption[] = [
  { label: 'Nome do lead', value: '{{lead_first_name}}', source: 'lead', column: 'lead_first_name' },
  { label: 'Sobrenome do lead', value: '{{lead_last_name}}', source: 'lead', column: 'lead_last_name' },
  { label: 'Email do lead', value: '{{lead_email}}', source: 'lead', column: 'lead_email' },
  { label: 'Telefone do lead', value: '{{lead_phone}}', source: 'lead', column: 'lead_phone' },
]
