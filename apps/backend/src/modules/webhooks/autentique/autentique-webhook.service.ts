import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SupabaseService } from '../../../common/supabase/supabase.service'
import { AutentiqueWebhookDto } from './dto/autentique-webhook.dto'

const EVENT_STATUS_MAP: Record<string, { contractStatus?: string; dealStatus?: string }> = {
  'document.created': { contractStatus: 'criado', dealStatus: 'contrato_enviado' },
  'document.viewed': { contractStatus: 'visualizado' },
  'document.signed': { contractStatus: 'assinado_parcial' },
  'document.finished': { contractStatus: 'assinado', dealStatus: 'contrato_assinado' },
}

@Injectable()
export class AutentiqueWebhookService {
  private readonly logger = new Logger(AutentiqueWebhookService.name)
  private readonly heartSchema: string

  constructor(
    private readonly supabase: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    this.heartSchema = this.configService.get('SUPABASE_HEART_SCHEMA') ?? 'heart'
  }

  async processWebhook(payload: AutentiqueWebhookDto) {
    const statusMap = EVENT_STATUS_MAP[payload.event] ?? {}

    if (statusMap.contractStatus) {
      await this.supabase
        .schema(this.heartSchema)
        .from('contratos')
        .update({
          status: statusMap.contractStatus,
          updated_at: new Date().toISOString(),
          document_id_autentique: payload.document_id,
        })
        .or(`document_id_autentique.eq.${payload.document_id},deal_id.eq.${payload.deal_id ?? ''}`)
    }

    if (payload.deal_id && statusMap.dealStatus) {
      await this.supabase
        .schema(this.heartSchema)
        .from('deals')
        .update({
          deal_status: statusMap.dealStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.deal_id)
    }

    this.logger.log(`Webhook Autentique recebido: ${payload.event} (${payload.document_id})`)
  }
}
