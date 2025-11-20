export type CpfConsultationStatus = 'success' | 'not_found' | 'error'

export type CpfConsultationResult = {
  status: CpfConsultationStatus
  data: Record<string, unknown> | null
  message?: string | null
}

export type CpfConsultationPayload = {
  cpf: string
}
