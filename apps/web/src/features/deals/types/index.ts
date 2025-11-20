export type DealStatus = 'negocio_novo' | 'contrato_enviado' | 'contrato_assinado' | 'contrato_rejeitado'

export type BrazilianState =
  | 'Acre'
  | 'Alagoas'
  | 'Amapá'
  | 'Amazonas'
  | 'Bahia'
  | 'Ceará'
  | 'Distrito Federal'
  | 'Espírito Santo'
  | 'Goiás'
  | 'Maranhão'
  | 'Mato Grosso'
  | 'Mato Grosso do Sul'
  | 'Minas Gerais'
  | 'Pará'
  | 'Paraíba'
  | 'Paraná'
  | 'Pernambuco'
  | 'Piauí'
  | 'Rio de Janeiro'
  | 'Rio Grande do Norte'
  | 'Rio Grande do Sul'
  | 'Rondônia'
  | 'Roraima'
  | 'Santa Catarina'
  | 'São Paulo'
  | 'Sergipe'
  | 'Tocantins'

export const BRAZILIAN_STATES: BrazilianState[] = [
  'Acre',
  'Alagoas',
  'Amapá',
  'Amazonas',
  'Bahia',
  'Ceará',
  'Distrito Federal',
  'Espírito Santo',
  'Goiás',
  'Maranhão',
  'Mato Grosso',
  'Mato Grosso do Sul',
  'Minas Gerais',
  'Pará',
  'Paraíba',
  'Paraná',
  'Pernambuco',
  'Piauí',
  'Rio de Janeiro',
  'Rio Grande do Norte',
  'Rio Grande do Sul',
  'Rondônia',
  'Roraima',
  'Santa Catarina',
  'São Paulo',
  'Sergipe',
  'Tocantins',
]

export type DealRecord = {
  id: string
  company_id: string | null
  deal_first_name: string | null
  deal_last_name: string | null
  deal_full_name: string | null
  deal_phone: string | null
  deal_email: string | null
  deal_status: DealStatus
  deal_cpf: string | null
  deal_rg: string | null
  deal_rua: string | null
  deal_numero: string | null
  deal_bairro: string | null
  deal_cidade: string | null
  deal_estado: BrazilianState | null
  deal_cep: string | null
  deal_servico: string | null
  deal_valor_contrato: string | number | null
  deal_forma_pagamento: string | null
  deal_parcelas: number | null
  deal_primeira_parcela?: string | null
  data_primeira_parcela: string | null
  parcelas_datas: Record<string, string> | null
  deal_documento_frente: string | null
  deal_documento_verso: string | null
  deal_audio: string | null
  deal_copia_contrato_assinado: string | null
  deal_comprovante_residencia: string | null
  vendedor_responsavel: string | null
  contact_fingerprint: string | null
  pixel_config_id: string | null
  data_nascimento: string | null
  created_at: string
  updated_at: string
}

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  negocio_novo: 'Negócios novos',
  contrato_enviado: 'Contrato enviado',
  contrato_assinado: 'Contrato assinado',
  contrato_rejeitado: 'Contrato rejeitado',
}

export type ServiceRecord = {
  id: string
  nome: string
  valor_padrao?: number | null
  max_parcelas?: number | null
  formas_pagamento?: string[] | null
}
