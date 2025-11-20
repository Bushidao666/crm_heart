import { Body, Controller, Headers, HttpCode, HttpStatus, Post, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AutentiqueWebhookDto } from './dto/autentique-webhook.dto'
import { AutentiqueWebhookService } from './autentique-webhook.service'

@Controller('webhooks/autentique')
export class AutentiqueWebhookController {
  private readonly secret?: string

  constructor(
    private readonly service: AutentiqueWebhookService,
    configService: ConfigService,
  ) {
    this.secret = configService.get<string>('AUTENTIQUE_WEBHOOK_SECRET')
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('x-autentique-signature') signature: string | undefined,
    @Body() payload: AutentiqueWebhookDto,
  ) {
    if (this.secret) {
      if (!signature || signature !== this.secret) {
        throw new UnauthorizedException('Assinatura inválida.')
      }
    }

    await this.service.processWebhook(payload)
    return { received: true }
  }
}
