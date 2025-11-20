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
    const forwarded = request.headers['x-forwarded-for']
    const ip =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0])?.trim() ||
      request.socket.remoteAddress ||
      null
    const userAgent = request.headers['user-agent'] ?? null

    await this.geolocationService.collect(user.id, ip, userAgent)

    return { success: true }
  }
}
