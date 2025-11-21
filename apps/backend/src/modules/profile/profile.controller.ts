import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common'

import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard'
import { AuthUser } from '../../common/decorators/auth-user.decorator'
import type { SupabaseAuthUser } from '../../common/interfaces/auth-user.interface'
import { ProfileService } from './profile.service'

@UseGuards(SupabaseAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  async getProfile(@AuthUser() user: SupabaseAuthUser) {
    const profile = await this.profileService.findProfileByUserId(user.id)

    if (!profile) {
      throw new NotFoundException('Perfil não encontrado para o usuário atual.')
    }

    return profile
  }
}
