import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Module } from '@nestjs/common';
import { EXCHANGES } from '@app/contracts';
import { WorkOrderAuditProducer } from './work-order-audit.producer';
import { WorkOrderEventsPublisher } from './work-order-events.publisher';

@Module({
  imports: [
    RabbitMQModule.forRoot({
      uri:
        process.env.RABBITMQ_URL ?? 'amqp://propflow:propflow@localhost:5672',
      exchanges: [{ name: EXCHANGES.EVENTS, type: 'topic' }],
    }),
  ],
  providers: [WorkOrderEventsPublisher, WorkOrderAuditProducer],
  exports: [WorkOrderEventsPublisher],
})
export class MessagingModule {}
