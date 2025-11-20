import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard'
import { AuthUser } from '../../common/decorators/auth-user.decorator'
import type { SupabaseAuthUser } from '../../common/interfaces/auth-user.interface'
import { TeamService } from './team.service'
import { InviteMemberDto } from './dto/invite-member.dto'
import { UpdateMemberDto } from './dto/update-member.dto'

@UseGuards(SupabaseAuthGuard)
@Controller('team')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post('invite')
  async invite(@AuthUser() user: SupabaseAuthUser, @Body() dto: InviteMemberDto) {
    const credentials = await this.teamService.invite(user.id, dto)
    return { success: true, credentials }
  }

  @Post('blacklist')
  async blacklist(@Body() dto: UpdateMemberDto) {
    await this.teamService.blacklist(dto)
    return { success: true }
  }

  @Post('delete')
  async delete(@AuthUser() user: SupabaseAuthUser, @Body() dto: UpdateMemberDto) {
    await this.teamService.remove(user.id, dto)
    return { success: true }
  }

  @Post('restore')
  async restore(@AuthUser() user: SupabaseAuthUser, @Body() dto: UpdateMemberDto) {
    await this.teamService.restore(user.id, dto)
    return { success: true }
  }
}
