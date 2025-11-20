import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SupabaseService } from '../../common/supabase/supabase.service'
import { LogActivityDto } from './dto/log-activity.dto'

@Injectable()
export class ActivityService {
  private readonly profileTable: string
  private readonly profileSchema: string

  constructor(
    private readonly supabase: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    this.profileTable = this.configService.get('SUPABASE_PROFILE_TABLE') ?? 'user_profiles'
    this.profileSchema = this.configService.get('SUPABASE_PROFILE_SCHEMA') ?? 'public'
  }

  async logActivity(userId: string, dto: LogActivityDto) {
    await this.updateUserStatus(userId, dto.event)
  }

  private async updateUserStatus(userId: string, event: LogActivityDto['event']) {
    let nextStatus: string | null = null

    if (event === 'logout' || event === 'idle') {
      nextStatus = 'offline'
    } else if (event === 'heartbeat') {
      nextStatus = 'online'
    }

    if (!nextStatus) {
      return
    }

    const now = new Date().toISOString()
    const query = this.supabase
      .schema(this.profileSchema)
      .from(this.profileTable)
      .update({
        status: nextStatus,
        last_activity: now,
      })

    const { error } = await query.or(`user_id.eq.${userId},id.eq.${userId}`)

    if (error) {
      throw error
    }
  }
}
