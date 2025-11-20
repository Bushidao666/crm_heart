import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard'
import { CpfService } from './cpf.service'
import { ConsultCpfDto } from './dto/consult-cpf.dto'

@Controller('cpf')
@UseGuards(SupabaseAuthGuard)
export class CpfController {
  constructor(private readonly cpfService: CpfService) {}

  @Post('consult')
  async consult(@Body() dto: ConsultCpfDto) {
    const result = await this.cpfService.consult(dto)
    return { success: true, result }
  }
}
