import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { Logger, ValidationPipe } from '@nestjs/common'
import helmet from 'helmet'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  })

  app.useLogger(new Logger())
  app.use(helmet())
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',').map((item) => item.trim()) ?? '*',
    credentials: true,
  })
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: true,
    }),
  )

  const port = Number(process.env.PORT ?? 3333)
  await app.listen(port)
  Logger.log(`🚀 Backend CRM Heart rodando na porta ${port}`, 'Bootstrap')
}

void bootstrap()
