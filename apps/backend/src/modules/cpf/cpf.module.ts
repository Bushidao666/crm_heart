import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { CpfController } from './cpf.controller'
import { CpfService } from './cpf.service'

@Module({
  imports: [HttpModule],
  controllers: [CpfController],
  providers: [CpfService],
})
export class CpfModule {}
