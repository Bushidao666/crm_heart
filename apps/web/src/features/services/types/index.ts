export type ServiceRecord = {
  id: string
  nome: string
  descricao: string | null
  valor_padrao: number
  max_parcelas: number
  formas_pagamento: string[]
  contrato_template_id: string | null
  company_id?: string | null
  created_at: string
  updated_at: string
}

export type ContractTemplateRecord = {
  id: string
  nome: string
  descricao: string | null
  ativo: boolean
}
