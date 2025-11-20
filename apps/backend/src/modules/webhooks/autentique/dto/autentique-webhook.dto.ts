import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'

export class AutentiqueWebhookDto {
  @IsEnum(['document.created', 'document.viewed', 'document.signed', 'document.finished'], {
    message: 'Evento inválido.',
  })
  event!: 'document.created' | 'document.viewed' | 'document.signed' | 'document.finished'

  @IsString()
  @MaxLength(120)
  document_id!: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  deal_id?: string

  @IsOptional()
  @IsString()
  signer_name?: string | null

  @IsOptional()
  @IsString()
  signer_email?: string | null

  @IsOptional()
  @IsString()
  status?: string | null
}
