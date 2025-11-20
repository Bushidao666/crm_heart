import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { DispatchRemarketingDto } from './dto/dispatch-remarketing.dto'

@Injectable()
export class RemarketingService {
  private readonly webhookUrl: string

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.webhookUrl =
      this.configService.get<string>('REMARKETING_WEBHOOK_URL') ?? 'https://example.com/remarketing'
  }

  async dispatch(userId: string, payload: DispatchRemarketingDto) {
    const body = {
      ...payload,
      requested_by: userId,
      dispatched_at: new Date().toISOString(),
    }

    await firstValueFrom(
      this.httpService.post(this.webhookUrl, body, {
        timeout: 10_000,
      }),
    )
  }
}
