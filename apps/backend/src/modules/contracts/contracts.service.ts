import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { SupabaseService } from '../../common/supabase/supabase.service'
import { CreateUploadUrlDto } from './dto/create-upload-url.dto'
import { DownloadTemplateDto } from './dto/download-template.dto'
import { SendContractDto } from './dto/send-contract.dto'

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name)
  private readonly bucket: string
  private readonly uploadExpires: number
  private readonly downloadExpires: number
  private readonly templateDetailsTable = 'contract_template_details'
  private readonly dealsTable = 'deals'
  private readonly heartSchema: string
  private readonly autentiqueUrl: string
  private readonly autentiqueToken: string

  constructor(
    private readonly supabase: SupabaseService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.bucket = this.configService.get('CONTRACT_TEMPLATE_BUCKET') ?? 'contract_templates'
    this.uploadExpires = Number(this.configService.get('CONTRACT_TEMPLATE_UPLOAD_EXPIRES') ?? 60)
    this.downloadExpires = Number(this.configService.get('CONTRACT_TEMPLATE_DOWNLOAD_EXPIRES') ?? 60)
    this.heartSchema = this.configService.get('SUPABASE_HEART_SCHEMA') ?? 'heart'
    this.autentiqueUrl =
      this.configService.get('AUTENTIQUE_API_URL') ?? 'https://api.autentique.com.br/graphql'
    this.autentiqueToken = this.configService.get('AUTENTIQUE_API_TOKEN') ?? 'autentique-token'
  }

  async createUploadUrl(userId: string, dto: CreateUploadUrlDto) {
    const sanitized = dto.fileName.replace(/[^a-z0-9_.-]+/gi, '-')
    const path = `templates/${userId}/${Date.now()}-${sanitized}`

    const storage = this.supabase.admin.storage.from(this.bucket)
    const { data, error } = await storage.createSignedUploadUrl(path, this.uploadExpires)

    if (error || !data?.token) {
      this.logger.error('Falha ao gerar URL assinada de upload', error)
      throw error ?? new InternalServerErrorException('Não foi possível gerar URL assinada.')
    }

    return { path, token: data.token }
  }

  async createDownloadUrl(dto: DownloadTemplateDto) {
    const path = await this.resolveTemplatePath(dto.templateId)
    if (!path) {
      throw new InternalServerErrorException('Template não possui arquivo associado.')
    }

    const storage = this.supabase.admin.storage.from(this.bucket)
    const { data, error } = await storage.createSignedUrl(path, this.downloadExpires)

    if (error || !data?.signedUrl) {
      this.logger.error('Falha ao gerar URL assinada de download', error)
      throw error ?? new InternalServerErrorException('Não foi possível gerar URL de download.')
    }

    return { signedUrl: data.signedUrl }
  }

  async sendContract(userId: string, dto: SendContractDto) {
    const payload = {
      dealId: dto.dealId,
      templateId: dto.templateId,
      previewHtml: dto.previewHtml ?? null,
      sortable: dto.sortable ?? true,
      signers: dto.signers,
      requestedBy: userId,
      sentAt: new Date().toISOString(),
      dealSnapshot: dto.dealSnapshot ?? {},
    }

    await firstValueFrom(
      this.httpService.post(this.autentiqueUrl, payload, {
        headers: {
          Authorization: `Bearer ${this.autentiqueToken}`,
        },
        timeout: 15_000,
      }),
    )

    await this.supabase
      .schema(this.heartSchema)
      .from(this.dealsTable)
      .update({
        deal_status: 'contrato_enviado',
        updated_at: new Date().toISOString(),
      })
      .eq('id', dto.dealId)

    return { success: true }
  }

  private async resolveTemplatePath(templateId: string) {
    const { data, error } = await this.supabase
      .schema(this.heartSchema)
      .from(this.templateDetailsTable)
      .select('storage_path')
      .eq('template_id', templateId)
      .maybeSingle()

    if (error) {
      this.logger.error('Erro ao buscar detalhes do template', error)
      throw error
    }

    return (data?.storage_path as string | undefined) ?? null
  }
}
