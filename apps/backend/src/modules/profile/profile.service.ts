import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { SupabaseService } from '../../common/supabase/supabase.service'

type CompanySchema = 'heart' | 'core'

type TeamMemberRow = {
  id: string
  user_id: string | null
  company_id: string | null
  user_name: string | null
  user_email: string | null
  role: string | null
  status: string | null
  last_activity: string | null
  metadata: Record<string, unknown> | null
  last_session: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
}

type ProfileRecord = TeamMemberRow & { schema: CompanySchema }

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name)
  private readonly tableName = 'equipe'
  private readonly selectColumns =
    'id, user_id, company_id, user_name, user_email, role, status, last_activity, metadata, last_session, created_at, updated_at'
  private readonly schemaPriority: CompanySchema[]

  constructor(private readonly supabase: SupabaseService, configService: ConfigService) {
    this.schemaPriority = this.parseSchemaPriority(configService.get('SUPABASE_PROFILE_SCHEMA_PRIORITY'))
  }

  async findProfileByUserId(userId: string): Promise<ProfileRecord | null> {
    for (const schema of this.schemaPriority) {
      const { data, error, status } = await this.supabase
        .schema(schema)
        .from<TeamMemberRow>(this.tableName)
        .select(this.selectColumns)
        .or(`id.eq.${userId},user_id.eq.${userId}`)
        .maybeSingle()

      if (error) {
        // 403 → RLS, 404 → tabela não exposta. Apenas registra e tenta próximo schema.
        if (status === 403 || status === 404) {
          this.logger.warn(`[${schema}] Perfil não acessível (${status}). Ignorando schema.`)
          continue
        }

        this.logger.error(`[${schema}] Falha ao buscar perfil para ${userId}`, error)
        throw new InternalServerErrorException('Não foi possível carregar os dados do usuário.')
      }

      if (data) {
        return { ...data, schema }
      }
    }

    return null
  }

  private parseSchemaPriority(rawValue?: string | null): CompanySchema[] {
    const fallback: CompanySchema[] = ['heart', 'core']
    const value = rawValue?.trim()
    if (!value) {
      return fallback
    }

    const parsed = value
      .split(',')
      .map((item) => item.trim())
      .filter((schema): schema is CompanySchema => schema === 'heart' || schema === 'core')
      .filter((schema, index, self) => self.indexOf(schema) === index)

    return parsed.length > 0 ? parsed : fallback
  }
}

export type { ProfileRecord, CompanySchema, TeamMemberRow }
