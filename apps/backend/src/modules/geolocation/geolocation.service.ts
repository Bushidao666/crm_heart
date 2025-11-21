import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class GeolocationService {
  private readonly logger = new Logger(GeolocationService.name)
  private readonly profileTable: string
  private readonly profileSchema: string
  private readonly ipdataUrl: string
  private readonly ipdataKey: string

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly supabase: SupabaseService,
  ) {
    this.profileTable = this.configService.get('SUPABASE_PROFILE_TABLE') ?? 'user_profiles'
    this.profileSchema = this.configService.get('SUPABASE_PROFILE_SCHEMA') ?? 'public'
    this.ipdataUrl = this.configService.get('IPDATA_API_URL') ?? 'https://api.ipdata.co'
    this.ipdataKey = this.configService.get('IPDATA_API_KEY') ?? ''
  }

  async collect(userId: string, ipAddress: string | null, userAgent?: string | null) {
    const geolocation = await this.fetchGeolocation(ipAddress)
    await this.updateTeamMetadata(userId, geolocation, ipAddress, userAgent)
  }

  private async fetchGeolocation(ipAddress: string | null) {
    if (!this.ipdataKey) {
      this.logger.warn('IPDATA_API_KEY não configurada; retornando IP básico.')
      return {
        ip: ipAddress,
      }
    }

    const normalizedBase = this.ipdataUrl.replace(/\/$/, '')
    const lookupUrl = ipAddress ? `${normalizedBase}/${ipAddress}` : normalizedBase

    try {
      const response = await firstValueFrom(
        this.httpService.get(lookupUrl, {
          params: {
            'api-key': this.ipdataKey,
          },
        }),
      )
      return response.data
    } catch (error) {
      this.logger.warn(`Falha ao consultar ipdata (${lookupUrl}).`, error as Error)
      return {
        ip: ipAddress,
        provider: 'ipdata',
      }
    }
  }

  private async updateTeamMetadata(
    userId: string,
    geolocation: Record<string, unknown>,
    ipAddress: string | null,
    userAgent?: string | null,
  ) {
    const { data, error } = await this.supabase
      .schema(this.profileSchema)
      .from(this.profileTable)
      .select('id, metadata, last_session')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      this.logger.error('Erro ao buscar registro de equipe para atualização de geolocalização', error)
      throw error
    }

    if (!data) {
      this.logger.warn(`Nenhum registro em ${this.profileSchema}.${this.profileTable} para user_id=${userId}`)
      return
    }

    const existingMetadata = (data.metadata as Record<string, unknown> | null) ?? {}
    const existingSession = (data.last_session as Record<string, unknown> | null) ?? {}
    const nextSession = {
      ...existingSession,
      ip_address: ipAddress,
      geolocation,
      last_geolocation_at: new Date().toISOString(),
      user_agent: userAgent ?? null,
    }

    const { error: updateError } = await this.supabase
      .schema(this.profileSchema)
      .from(this.profileTable)
      .update({
        metadata: existingMetadata,
        last_session: nextSession,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id)

    if (updateError) {
      this.logger.error('Erro ao atualizar metadados de geolocalização na tabela de equipe', updateError)
      throw updateError
    }
  }
}
