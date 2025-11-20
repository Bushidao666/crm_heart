import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator'

export class InviteMemberDto {
  @IsEmail()
  @MaxLength(150)
  email!: string

  @IsString()
  @MaxLength(120)
  name!: string

  @IsString()
  @MaxLength(50)
  role!: string

  @IsOptional()
  @IsString()
  companyId?: string
}
