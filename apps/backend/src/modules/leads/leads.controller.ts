import { Body, Controller, Post, UseGuards } from '@nestjs/common'

import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard'
import { AuthUser } from '../../common/decorators/auth-user.decorator'
import type { SupabaseAuthUser } from '../../common/interfaces/auth-user.interface'
import { TransferLeadOwnerDto } from './dto/transfer-lead-owner.dto'
import { LeadsService } from './leads.service'

@UseGuards(SupabaseAuthGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post('transfer-owner')
  async transferOwner(@AuthUser() user: SupabaseAuthUser, @Body() dto: TransferLeadOwnerDto) {
    const updatedLead = await this.leadsService.transferLeadOwner(user, dto)

    return {
      success: true,
      lead: updatedLead,
    }
  }
}
