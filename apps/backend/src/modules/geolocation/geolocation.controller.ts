import { Controller, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard'
import { AuthUser } from '../../common/decorators/auth-user.decorator'
import type { SupabaseAuthUser } from '../../common/interfaces/auth-user.interface'
import { GeolocationService } from './geolocation.service'

@Controller('geolocation')
export class GeolocationController {
  constructor(private readonly geolocationService: GeolocationService) {}

  @Post('collect')
  @UseGuards(SupabaseAuthGuard)
  async collect(@AuthUser() user: SupabaseAuthUser, @Req() request: Request) {
    const ip = this.extractClientIp(request)
    const userAgent = request.headers['user-agent'] ?? null

    await this.geolocationService.collect(user.id, ip, userAgent)

    return { success: true }
  }

  private extractClientIp(request: Request) {
    const headerCandidates = ['x-forwarded-for', 'cf-connecting-ip', 'x-real-ip', 'x-client-ip'] as const

    for (const header of headerCandidates) {
      const value = request.headers[header]
      if (!value) continue

      const parsed = Array.isArray(value) ? value[0] : value.split(',')[0]
      const trimmed = parsed?.trim()
      if (trimmed) {
        return trimmed
      }
    }

    return request.socket.remoteAddress || null
  }
}
