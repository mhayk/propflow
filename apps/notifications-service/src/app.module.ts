import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { buildLoggerOptions } from '@app/observability';
import { AppController } from './app.controller';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot(buildLoggerOptions('notifications-service')),
    NotificationsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
