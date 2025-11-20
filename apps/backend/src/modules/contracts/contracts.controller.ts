import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard'
import { AuthUser } from '../../common/decorators/auth-user.decorator'
import type { SupabaseAuthUser } from '../../common/interfaces/auth-user.interface'
import { ContractsService } from './contracts.service'
import { CreateUploadUrlDto } from './dto/create-upload-url.dto'
import { DownloadTemplateDto } from './dto/download-template.dto'
import { SendContractDto } from './dto/send-contract.dto'

@UseGuards(SupabaseAuthGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post('upload-url')
  async createUploadUrl(@AuthUser() user: SupabaseAuthUser, @Body() dto: CreateUploadUrlDto) {
    return this.contractsService.createUploadUrl(user.id, dto)
  }

  @Post('download-url')
  async createDownloadUrl(@Body() dto: DownloadTemplateDto) {
    return this.contractsService.createDownloadUrl(dto)
  }

  @Post('send')
  async sendContract(@AuthUser() user: SupabaseAuthUser, @Body() dto: SendContractDto) {
    return this.contractsService.sendContract(user.id, dto)
  }
}
