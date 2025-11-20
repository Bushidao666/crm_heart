import { HttpService } from '@nestjs/axios'
import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { AdminUserAttributes } from '@supabase/supabase-js'

import { SupabaseService } from '../../common/supabase/supabase.service'

type MemberRecord = {
  id: string
  user_id: string | null
  metadata: Record<string, unknown> | null
}

type BanActionOptions = {
  reason?: string
  bannedBy?: string | null
}

type UnbanActionOptions = {
  restoredBy?: string | null
}

type AdminUserUpdatePayload = AdminUserAttributes & { banDuration?: string | null }

@Injectable()
export class TeamBanService {
  private readonly heartSchema: string
  private readonly tableName = 'equipe'
  private readonly logger = new Logger(TeamBanService.name)

  constructor(
    private readonly supabase: SupabaseService,
    private readonly httpService: HttpService,
    configService: ConfigService,
  ) {
    this.heartSchema = configService.get('SUPABASE_HEART_SCHEMA') ?? 'heart'
  }

  async banMemberByRecordId(memberId: string, options?: BanActionOptions) {
    const member = await this.findMember(memberId)
    await this.markMemberRemoved(member, options)

    if (member.user_id) {
      await this.disableAuthUser(member.user_id, options)
    }
  }

  async unbanMemberByRecordId(memberId: string, options?: UnbanActionOptions) {
    const member = await this.findMember(memberId)
    await this.restoreMember(member, options)

    if (member.user_id) {
      await this.enableAuthUser(member.user_id)
    }
  }

  private async findMember(memberId: string): Promise<MemberRecord> {
    const { data, error } = await this.supabase
      .schema(this.heartSchema)
      .from(this.tableName)
      .select('id, user_id, metadata')
      .eq('id', memberId)
      .maybeSingle<MemberRecord>()

    if (error) {
      this.logger.error(`Falha ao carregar membro ${memberId} para banimento`, error)
      throw new InternalServerErrorException('Não foi possível carregar o usuário informado.')
    }

    if (!data) {
      throw new NotFoundException('Usuário não encontrado.')
    }

    return data
  }

  private sanitizeMetadata(metadata: Record<string, unknown> | null): Record<string, unknown> {
    if (!metadata || Array.isArray(metadata)) {
      return {}
    }
    return { ...metadata }
  }

  private async markMemberRemoved(member: MemberRecord, options?: BanActionOptions) {
    const now = new Date().toISOString()
    const metadata = this.sanitizeMetadata(member.metadata)
    metadata.removed = true
    metadata.removed_at = now
    metadata.removed_by = options?.bannedBy ?? null
    metadata.ban_reason = options?.reason ?? 'removed_from_team'

    const { error } = await this.supabase
      .schema(this.heartSchema)
      .from(this.tableName)
      .update({
        status: 'removed',
        metadata,
      })
      .eq('id', member.id)

    if (error) {
      this.logger.error(`Falha ao atualizar status para removed no membro ${member.id}`, error)
      throw new InternalServerErrorException('Não foi possível atualizar o status do usuário.')
    }

    this.logger.log(`Membro ${member.id} marcado como removed.`)
  }

  private async restoreMember(member: MemberRecord, options?: UnbanActionOptions) {
    const now = new Date().toISOString()
    const metadata = this.sanitizeMetadata(member.metadata)
    delete metadata.removed
    delete metadata.removed_at
    delete metadata.removed_by
    delete metadata.ban_reason
    metadata.unbanned_at = now
    metadata.unbanned_by = options?.restoredBy ?? null

    const { error } = await this.supabase
      .schema(this.heartSchema)
      .from(this.tableName)
      .update({
        status: 'active',
        metadata,
      })
      .eq('id', member.id)

    if (error) {
      this.logger.error(`Falha ao restaurar o membro ${member.id}`, error)
      throw new InternalServerErrorException('Não foi possível restaurar o acesso do usuário.')
    }

    this.logger.log(`Membro ${member.id} restaurado com sucesso.`)
  }

  private async disableAuthUser(userId: string, options?: BanActionOptions) {
    await this.revokeSessions(userId)

    const bannedAt = new Date().toISOString()
    const reason = options?.reason ?? 'removed_from_team'

    const attributes: AdminUserUpdatePayload = {
      banDuration: '100000h',
      app_metadata: {
        disabled: true,
        banned_at: bannedAt,
        ban_reason: reason,
      },
    }

    const { error } = await this.supabase.admin.auth.admin.updateUserById(userId, attributes)

    if (error) {
      this.logger.error(`Falha ao desativar usuário ${userId}`, error)
      throw new InternalServerErrorException('Não foi possível revogar o acesso do usuário.')
    }

    this.logger.log(`Usuário ${userId} banido com sucesso.`)
  }

  private async enableAuthUser(userId: string) {
    const attributes: AdminUserUpdatePayload = {
      banDuration: 'none',
      app_metadata: {
        disabled: false,
        banned_at: null,
        ban_reason: null,
      },
    }

    const { error } = await this.supabase.admin.auth.admin.updateUserById(userId, attributes)

    if (error) {
      this.logger.error(`Falha ao reativar usuário ${userId}`, error)
      throw new InternalServerErrorException('Não foi possível restaurar o acesso do usuário.')
    }

    this.logger.log(`Usuário ${userId} reativado com sucesso.`)
  }

  private async revokeSessions(userId: string) {
    const url = `${this.supabase.url}/auth/v1/admin/users/${userId}/logout`
    try {
      await this.httpService.axiosRef.post(
        url,
        {},
        {
          headers: {
            apikey: this.supabase.serviceKey,
            Authorization: `Bearer ${this.supabase.serviceKey}`,
          },
          validateStatus: (status) => status < 400 || status === 404,
        },
      )
    } catch (error) {
      this.logger.error(`Erro ao revogar sessões do usuário ${userId}`, error)
    }
  }
}
