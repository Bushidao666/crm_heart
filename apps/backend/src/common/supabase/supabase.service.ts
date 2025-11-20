import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name)
  private readonly client: SupabaseClient
  private readonly serviceRoleKey: string
  private readonly supabaseUrl: string

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL')
    const serviceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')

    if (!url || !serviceRoleKey) {
      throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios')
    }

    this.supabaseUrl = url
    this.serviceRoleKey = serviceRoleKey
    this.client = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }

  get admin() {
    return this.client
  }

  schema(schema?: string) {
    return schema ? this.client.schema(schema) : this.client
  }

  async getUserFromAccessToken(token: string): Promise<User> {
    const { data, error } = await this.client.auth.getUser(token)
    if (error || !data?.user) {
      this.logger.warn(`Falha ao validar token de acesso: ${error?.message}`)
      throw error ?? new Error('Token inválido')
    }
    return data.user
  }

  get serviceKey() {
    return this.serviceRoleKey
  }

  get url() {
    return this.supabaseUrl
  }
}
