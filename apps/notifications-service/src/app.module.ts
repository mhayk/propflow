import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { buildLoggerOptions, MetricsModule } from '@app/observability';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot(buildLoggerOptions('notifications-service')),
    MetricsModule.forRoot('notifications-service'),
    HealthModule,
    NotificationsModule,
  ],
})
export class AppModule {}
