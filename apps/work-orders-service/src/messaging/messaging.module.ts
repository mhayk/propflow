import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Module } from '@nestjs/common';
import { EXCHANGES } from '@app/contracts';
import { OutboxRelay } from './outbox-relay';
import { WorkOrderAuditProducer } from './work-order-audit.producer';
import { WorkOrderEventsOutbox } from './work-order-events.outbox';

@Module({
  imports: [
    RabbitMQModule.forRoot({
      uri:
        process.env.RABBITMQ_URL ?? 'amqp://propflow:propflow@localhost:5672',
      exchanges: [{ name: EXCHANGES.EVENTS, type: 'topic' }],
    }),
  ],
  providers: [WorkOrderEventsOutbox, OutboxRelay, WorkOrderAuditProducer],
  exports: [WorkOrderEventsOutbox],
})
export class MessagingModule {}
