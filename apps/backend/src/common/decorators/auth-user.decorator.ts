import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { SupabaseAuthUser } from '../interfaces/auth-user.interface'

export const AuthUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): SupabaseAuthUser | null => {
  const request = ctx.switchToHttp().getRequest<{ user?: SupabaseAuthUser }>()
  return request.user ?? null
})
