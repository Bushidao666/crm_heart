import { IsString, Length } from 'class-validator'

export class ConsultCpfDto {
  @IsString()
  @Length(11, 14)
  document!: string
}
