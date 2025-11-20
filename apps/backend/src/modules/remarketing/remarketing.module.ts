import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { RemarketingController } from './remarketing.controller'
import { RemarketingService } from './remarketing.service'

@Module({
  imports: [HttpModule],
  controllers: [RemarketingController],
  providers: [RemarketingService],
})
export class RemarketingModule {}
