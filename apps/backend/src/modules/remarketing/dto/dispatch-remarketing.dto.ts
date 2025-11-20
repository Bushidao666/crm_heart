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

class RemarketingLeadDto {
  @IsString()
  @MaxLength(120)
  id!: string

  @IsOptional()
  @IsString()
  email?: string

  @IsOptional()
  @IsString()
  phone?: string
}

export class DispatchRemarketingDto {
  @IsString()
  @MaxLength(120)
  templateId!: string

  @IsOptional()
  @IsString()
  audienceType?: string

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RemarketingLeadDto)
  leads!: RemarketingLeadDto[]

  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>

  @IsOptional()
  @IsBoolean()
  requireOptIn?: boolean
}
