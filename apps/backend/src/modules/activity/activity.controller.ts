import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard'
import { AuthUser } from '../../common/decorators/auth-user.decorator'
import type { SupabaseAuthUser } from '../../common/interfaces/auth-user.interface'
import { ActivityService } from './activity.service'
import { LogActivityDto } from './dto/log-activity.dto'

@UseGuards(SupabaseAuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Post()
  async log(@AuthUser() user: SupabaseAuthUser, @Body() dto: LogActivityDto) {
    await this.activityService.logActivity(user.id, dto)
    return { success: true }
  }
}
