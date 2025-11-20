import { IsString, MaxLength } from 'class-validator'

export class CreateUploadUrlDto {
  @IsString()
  @MaxLength(255)
  fileName!: string
}
