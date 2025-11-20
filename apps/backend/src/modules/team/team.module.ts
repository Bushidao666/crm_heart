import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { TeamController } from './team.controller'
import { TeamService } from './team.service'
import { TeamBanService } from './team-ban.service'

@Module({
  imports: [HttpModule],
  controllers: [TeamController],
  providers: [TeamService, TeamBanService],
})
export class TeamModule {}
