import { IsString, MaxLength } from 'class-validator'

export class UpdateMemberDto {
  @IsString()
  @MaxLength(64)
  userId!: string
}
