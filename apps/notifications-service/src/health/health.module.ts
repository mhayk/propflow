import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { NotificationsModule } from '../notifications/notifications.module';
import { HealthController } from './health.controller';
import { RabbitMQHealthIndicator } from './rabbitmq.health';

@Module({
  // NotificationsModule re-exports the RabbitMQ module, providing AmqpConnection.
  imports: [TerminusModule, NotificationsModule],
  controllers: [HealthController],
  providers: [RabbitMQHealthIndicator],
})
export class HealthModule {}
