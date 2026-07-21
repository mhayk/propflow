import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { buildLoggerOptions } from '@app/observability';
import { AppController } from './app.controller';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot(buildLoggerOptions('api-gateway')),
    GatewayModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
