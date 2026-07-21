import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Module } from '@nestjs/common';
import { EXCHANGES } from '@app/contracts';
import { EventRetryHandler } from './event-retry.handler';
import { resilienceQueues } from './messaging-resilience';
import {
  LoggingNotificationSender,
  NotificationSender,
} from './notification-sender';
import { QUEUES, WorkOrderEventsConsumer } from './work-order-events.consumer';

@Module({
  imports: [
    RabbitMQModule.forRoot({
      uri:
        process.env.RABBITMQ_URL ?? 'amqp://propflow:propflow@localhost:5672',
      exchanges: [
        { name: EXCHANGES.EVENTS, type: 'topic' },
        { name: EXCHANGES.DEAD_LETTER, type: 'topic' },
      ],
      queues: [
        ...resilienceQueues(QUEUES.WORK_ORDER_CREATED),
        ...resilienceQueues(QUEUES.WORK_ORDER_COMPLETED),
      ],
      // Consumers must not lose messages on crash: ack only after the
      // handler finishes (golevelup's default), one channel per app.
      prefetchCount: 10,
    }),
  ],
  providers: [
    EventRetryHandler,
    WorkOrderEventsConsumer,
    { provide: NotificationSender, useClass: LoggingNotificationSender },
  ],
})
export class NotificationsModule {}
