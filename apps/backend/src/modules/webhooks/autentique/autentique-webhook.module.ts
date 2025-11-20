import { Module } from '@nestjs/common'
import { AutentiqueWebhookController } from './autentique-webhook.controller'
import { AutentiqueWebhookService } from './autentique-webhook.service'

@Module({
  controllers: [AutentiqueWebhookController],
  providers: [AutentiqueWebhookService],
})
export class AutentiqueWebhookModule {}
