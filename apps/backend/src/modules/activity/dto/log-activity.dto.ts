import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator'

const ALLOWED_EVENTS = ['heartbeat', 'idle', 'logout'] as const

export class LogActivityDto {
  @IsString()
  @MaxLength(50)
  @IsEnum(ALLOWED_EVENTS, {
    message: `Evento inválido. Use: ${ALLOWED_EVENTS.join(', ')}`,
  })
  event!: (typeof ALLOWED_EVENTS)[number]

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}
