import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { buildLoggerOptions, MetricsModule } from '@app/observability';
import { HealthModule } from './health/health.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot(buildLoggerOptions('api-gateway')),
    MetricsModule.forRoot('api-gateway'),
    HealthModule,
    GatewayModule,
  ],
})
export class AppModule {}
