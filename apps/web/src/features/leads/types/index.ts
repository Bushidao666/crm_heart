export type LeadStatus = 'lead_novo' | 'em_atendimento' | 'descartado' | 'convertido'

export type LeadRecord = {
  id: string
  company_id: string | null
  lead_first_name: string | null
  lead_last_name: string | null
  lead_phone: string | null
  lead_email: string | null
  lead_status: LeadStatus
  motivo_descarte: string | null
  vendedor_responsavel: string | null
  contact_fingerprint: string | null
  pixel_config_id: string | null
  created_at: string
  updated_at: string
}

export type LeadsColumn = 'lead_novo' | 'em_atendimento' | 'descartado' | 'convertido'

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  lead_novo: 'Leads novos',
  em_atendimento: 'Em atendimento',
  descartado: 'Descartados',
  convertido: 'Convertidos',
}

export const DISCARD_REASONS = [
  'Sem resposta do lead',
  'Número inválido',
  'Sem interesse',
  'Sem dinheiro',
  'Lead duplicado',
  'já possuí contrato conosco',
] as const satisfies readonly string[]

export type DiscardReason = (typeof DISCARD_REASONS)[number]
