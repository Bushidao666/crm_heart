import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import { ConsultCpfDto } from './dto/consult-cpf.dto'

@Injectable()
export class CpfService {
  private readonly providerUrl: string
  private readonly providerToken: string

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.providerUrl = this.configService.get('CPF_PROVIDER_URL') ?? 'https://example.com/cpf'
    this.providerToken = this.configService.get('CPF_PROVIDER_TOKEN') ?? ''
  }

  async consult(dto: ConsultCpfDto) {
    const response = await firstValueFrom(
      this.httpService.post(
        this.providerUrl,
        { document: dto.document },
        {
          headers: {
            Authorization: this.providerToken ? `Bearer ${this.providerToken}` : undefined,
          },
        },
      ),
    )

    return response.data
  }
}
