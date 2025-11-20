import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'
import { SupabaseService } from '../supabase/supabase.service'
import type { SupabaseAuthUser } from '../interfaces/auth-user.interface'

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly profileSchema: string
  private readonly profileTable: string

  constructor(
    private readonly supabaseService: SupabaseService,
    configService: ConfigService,
  ) {
    this.profileSchema = configService.get('SUPABASE_PROFILE_SCHEMA') ?? 'public'
    this.profileTable = configService.get('SUPABASE_PROFILE_TABLE') ?? 'equipe'
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: SupabaseAuthUser }>()
    const authorization = request.headers.authorization

    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de acesso não informado.')
    }

    const token = authorization.replace('Bearer ', '').trim()
    try {
      const user = await this.supabaseService.getUserFromAccessToken(token)

      if ((user.app_metadata as Record<string, unknown> | undefined)?.disabled) {
        throw new UnauthorizedException('Conta desativada. Entre em contato com o administrador.')
      }
      const { data, error } = await this.supabaseService
        .schema(this.profileSchema)
        .from(this.profileTable)
        .select('status')
        .or(`user_id.eq.${user.id},id.eq.${user.id}`)
        .maybeSingle<{ status: string | null }>()

      if (error) {
        throw error
      }

      if (data?.status === 'removed') {
        throw new UnauthorizedException('Conta desativada. Entre em contato com o administrador.')
      }

      request.user = user
      return true
    } catch (error) {
      throw new UnauthorizedException('Sessão inválida ou expirada.', { cause: error as Error })
    }
  }
}
