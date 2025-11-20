import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

class ContractSignerDto {
  @IsString()
  @MaxLength(120)
  name!: string

  @IsString()
  @MaxLength(150)
  email!: string

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(14)
  cpf?: string | null

  @IsString()
  @MaxLength(20)
  deliveryMethod!: 'email' | 'whatsapp' | 'sms'

  @IsString()
  @MaxLength(20)
  role!: 'SIGNER' | 'WITNESS'
}

export class SendContractDto {
  @IsString()
  @MaxLength(64)
  dealId!: string

  @IsString()
  @MaxLength(64)
  templateId!: string

  @IsOptional()
  @IsString()
  previewHtml?: string | null

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ContractSignerDto)
  signers!: ContractSignerDto[]

  @IsOptional()
  @IsBoolean()
  sortable?: boolean

  @IsOptional()
  @IsObject()
  dealSnapshot?: Record<string, unknown>
}
