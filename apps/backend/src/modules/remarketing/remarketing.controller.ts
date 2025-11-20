import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard'
import { RemarketingService } from './remarketing.service'
import { DispatchRemarketingDto } from './dto/dispatch-remarketing.dto'
import { AuthUser } from '../../common/decorators/auth-user.decorator'
import type { SupabaseAuthUser } from '../../common/interfaces/auth-user.interface'

@Controller('remarketing')
@UseGuards(SupabaseAuthGuard)
export class RemarketingController {
  constructor(private readonly remarketingService: RemarketingService) {}

  @Post('dispatch')
  async dispatch(@AuthUser() user: SupabaseAuthUser, @Body() dto: DispatchRemarketingDto) {
    await this.remarketingService.dispatch(user.id, dto)
    return { success: true }
  }
}
