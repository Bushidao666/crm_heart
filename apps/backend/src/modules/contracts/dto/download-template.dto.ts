import { IsString, MaxLength } from 'class-validator'

export class DownloadTemplateDto {
  @IsString()
  @MaxLength(64)
  templateId!: string
}
