import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common'

import type { SupabaseAuthUser } from '../../common/interfaces/auth-user.interface'
import { SupabaseService } from '../../common/supabase/supabase.service'
import { TransferLeadOwnerDto } from './dto/transfer-lead-owner.dto'

const ADMIN_ROLES = ['admin', 'crm_admin', 'brain_admin', 'backoffice_admin'] as const

@Injectable()
export class LeadsService {
  private readonly heartSchema = 'heart'
  private readonly logger = new Logger(LeadsService.name)

  constructor(private readonly supabase: SupabaseService) {}

  async transferLeadOwner(user: SupabaseAuthUser, dto: TransferLeadOwnerDto) {
    this.logger.log(
      `TransferLeadOwner solicitado pelo usuário ${user.id} para lead ${dto.leadId} e novo responsável ${dto.newOwnerId}`,
    )
    const hasAccess = await this.hasAdminAccess(user)
    if (!hasAccess) {
      this.logger.warn(`TransferLeadOwner negado para ${user.id}: usuário sem permissão`)
      throw new ForbiddenException('Somente administradores podem transferir leads.')
    }

    const { data: lead, error: leadError } = await this.supabase
      .schema(this.heartSchema)
      .from('leads_captura')
      .select('id, company_id, vendedor_responsavel')
      .eq('id', dto.leadId)
      .maybeSingle()

    if (leadError) {
      this.logger.error('Erro ao buscar lead antes da transferência', leadError)
      throw new InternalServerErrorException('Não foi possível carregar o lead informado.')
    }

    if (!lead) {
      this.logger.warn(`Lead ${dto.leadId} não encontrado para transferência.`)
      throw new NotFoundException('Lead não encontrado.')
    }

    const { data: targetUser, error: targetUserError } = await this.supabase
      .schema(this.heartSchema)
      .from('crm_user_profiles')
      .select('user_id, company_id, status, role')
      .eq('user_id', dto.newOwnerId)
      .eq('company_id', lead.company_id)
      .eq('role', 'vendedor')
      .not('status', 'eq', 'removed')
      .maybeSingle()

    if (targetUserError) {
      this.logger.error('Erro ao buscar o novo responsável antes da transferência', targetUserError)
      throw new InternalServerErrorException('Não foi possível validar o novo responsável informado.')
    }

    if (!targetUser) {
      this.logger.warn(
        `Novo responsável ${dto.newOwnerId} não encontrado ou não pertence à empresa ${lead.company_id}.`,
      )
      throw new BadRequestException('Vendedor alvo inválido para esta empresa.')
    }

    this.logger.log(
      `Transferindo lead ${lead.id} da empresa ${lead.company_id ?? 'desconhecida'} do responsável ${
        lead.vendedor_responsavel ?? 'desconhecido'
      } para ${dto.newOwnerId}`,
    )
    const { data: updatedLead, error: updateError } = await this.supabase
      .schema(this.heartSchema)
      .from('leads_captura')
      .update({
        vendedor_responsavel: dto.newOwnerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dto.leadId)
      .eq('company_id', lead.company_id)
      .select('*')
      .maybeSingle()

    if (updateError) {
      this.logger.error('Erro ao atualizar o responsável do lead.', updateError)
      throw new InternalServerErrorException('Não foi possível transferir o responsável do lead.')
    }

    if (!updatedLead) {
      this.logger.error(
        `Falha desconhecida ao atualizar lead ${dto.leadId}. Supabase retornou resposta vazia.`,
      )
      throw new InternalServerErrorException('Falha ao atualizar o lead informado.')
    }

    this.logger.log(
      `Transferência concluída para lead ${dto.leadId}. Novo responsável: ${updatedLead.vendedor_responsavel}`,
    )
    return updatedLead
  }
  private async hasAdminAccess(user: SupabaseAuthUser): Promise<boolean> {
    const metadata = (user.app_metadata ?? {}) as Record<string, unknown>
    const userMetadata = (user.user_metadata ?? {}) as Record<string, unknown>

    const rolesFromMetadata = this.extractRoles(metadata)
    const rolesFromUserMetadata = this.extractRoles(userMetadata)

    if (rolesFromMetadata.some((role) => ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number]))) {
      return true
    }

    if (
      rolesFromUserMetadata.some((role) => ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number]))
    ) {
      return true
    }

    const { data } = await this.supabase
      .schema(this.heartSchema)
      .from('equipe')
      .select('role')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle<{ role: string | null }>()

    if (data?.role && ADMIN_ROLES.includes(data.role as (typeof ADMIN_ROLES)[number])) {
      return true
    }

    return false
  }

  private extractRoles(metadata: Record<string, unknown>): string[] {
    const roles: string[] = []
    if (typeof metadata.role === 'string') {
      roles.push(metadata.role)
    }

    if (Array.isArray(metadata.roles)) {
      for (const role of metadata.roles) {
        if (typeof role === 'string') {
          roles.push(role)
        }
      }
    }

    return roles
  }
}
