import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { EXCHANGES, WORK_ORDER_EVENTS } from '@app/contracts';
import type { WorkOrderEvent } from '@app/contracts';
import { NotificationSender } from './notification-sender';

export const QUEUES = {
  WORK_ORDER_CREATED: 'notifications.work-order-created',
  WORK_ORDER_COMPLETED: 'notifications.work-order-completed',
} as const;

@Injectable()
export class WorkOrderEventsConsumer {
  private readonly logger = new Logger(WorkOrderEventsConsumer.name);

  constructor(private readonly sender: NotificationSender) {}

  @RabbitSubscribe({
    exchange: EXCHANGES.EVENTS,
    routingKey: WORK_ORDER_EVENTS.CREATED,
    queue: QUEUES.WORK_ORDER_CREATED,
    queueOptions: { durable: true },
  })
  async onWorkOrderCreated(event: WorkOrderEvent): Promise<void> {
    this.logger.log(`received ${event.type} (${event.eventId})`);
    await this.sender.send({
      // Recipient resolution (property manager lookup) arrives with the
      // Properties service; a deterministic placeholder keeps the flow honest.
      recipient: `manager-of-${event.data.propertyId}`,
      subject: `New work order: ${event.data.title}`,
      body: `A ${event.data.priority} priority work order was opened for property ${event.data.propertyId}.`,
    });
  }

  @RabbitSubscribe({
    exchange: EXCHANGES.EVENTS,
    routingKey: WORK_ORDER_EVENTS.COMPLETED,
    queue: QUEUES.WORK_ORDER_COMPLETED,
    queueOptions: { durable: true },
  })
  async onWorkOrderCompleted(event: WorkOrderEvent): Promise<void> {
    this.logger.log(`received ${event.type} (${event.eventId})`);
    await this.sender.send({
      recipient: `tenant-of-${event.data.propertyId}`,
      subject: `Work order completed: ${event.data.title}`,
      body: `The work order for property ${event.data.propertyId} has been completed.`,
    });
  }
}
