import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ActivityModule } from './modules/activity/activity.module'
import { SupabaseModule } from './common/supabase/supabase.module'
import { GeolocationModule } from './modules/geolocation/geolocation.module'
import { RemarketingModule } from './modules/remarketing/remarketing.module'
import { ContractsModule } from './modules/contracts/contracts.module'
import { CpfModule } from './modules/cpf/cpf.module'
import { TeamModule } from './modules/team/team.module'
import { AutentiqueWebhookModule } from './modules/webhooks/autentique/autentique-webhook.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SupabaseModule,
    ActivityModule,
    GeolocationModule,
    RemarketingModule,
    ContractsModule,
    CpfModule,
    TeamModule,
    AutentiqueWebhookModule,
  ],
})
export class AppModule {}
