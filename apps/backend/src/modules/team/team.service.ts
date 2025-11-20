import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomBytes } from 'node:crypto'
import { SupabaseService } from '../../common/supabase/supabase.service'
import { InviteMemberDto } from './dto/invite-member.dto'
import { UpdateMemberDto } from './dto/update-member.dto'
import { TeamBanService } from './team-ban.service'

@Injectable()
export class TeamService {
  private readonly heartSchema: string
  private readonly tableName = 'equipe'

  constructor(
    private readonly supabase: SupabaseService,
    private readonly configService: ConfigService,
    private readonly teamBanService: TeamBanService,
  ) {
    this.heartSchema = this.configService.get('SUPABASE_HEART_SCHEMA') ?? 'heart'
  }

  async invite(userId: string, dto: InviteMemberDto) {
    const companyId = dto.companyId ?? (await this.resolveCompanyId(userId))
    if (!companyId) {
      throw new BadRequestException('Não foi possível determinar a empresa do convite.')
    }

    const normalizedEmail = dto.email.trim().toLowerCase()
    const normalizedName = dto.name.trim()
    const password = this.generatePassword()

    const { data: created, error: createError } = await this.supabase.admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: normalizedName,
        role: dto.role,
      },
      app_metadata: {
        role: dto.role,
      },
    })

    if (createError || !created?.user) {
      throw new BadRequestException(createError?.message ?? 'Falha ao criar usuário no Supabase Auth.')
    }

    const insertPayload = {
      company_id: companyId,
      user_id: created.user.id,
      user_email: normalizedEmail,
      user_name: normalizedName,
      role: dto.role,
      metadata: {
        created_by: userId,
        created_at: new Date().toISOString(),
      },
    }

    const { error: insertError } = await this.supabase
      .schema(this.heartSchema)
      .from(this.tableName)
      .insert(insertPayload)

    if (insertError) {
      await this.supabase.admin.auth.admin.deleteUser(created.user.id)
      throw new InternalServerErrorException(insertError.message ?? 'Falha ao registrar o usuário no CRM.')
    }

    return {
      email: normalizedEmail,
      name: normalizedName,
      password,
      role: dto.role,
    }
  }

  async blacklist(dto: UpdateMemberDto) {
    await this.supabase
      .schema(this.heartSchema)
      .from(this.tableName)
      .update({
        status: 'blacklisted',
        metadata: {
          updated_at: new Date().toISOString(),
        },
      })
      .eq('id', dto.userId)
  }

  async remove(requesterId: string, dto: UpdateMemberDto) {
    await this.teamBanService.banMemberByRecordId(dto.userId, {
      reason: 'removed_from_team',
      bannedBy: requesterId,
    })
  }

  async restore(requesterId: string, dto: UpdateMemberDto) {
    await this.teamBanService.unbanMemberByRecordId(dto.userId, {
      restoredBy: requesterId,
    })
  }

  private async resolveCompanyId(userId: string) {
    const { data } = await this.supabase
      .schema(this.heartSchema)
      .from(this.tableName)
      .select('company_id')
      .eq('user_id', userId)
      .maybeSingle()

    return (data?.company_id as string | undefined) ?? null
  }

  private generatePassword(length = 12) {
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
    const random = randomBytes(length)
    let password = ''
    for (let index = 0; index < length; index += 1) {
      const byte = random[index]
      password += charset[byte % charset.length]
    }
    return password
  }
}
