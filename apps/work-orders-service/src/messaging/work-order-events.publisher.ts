import { randomUUID } from 'node:crypto';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { EXCHANGES, WorkOrderEvent, WorkOrderEventType } from '@app/contracts';
import { WorkOrder } from '../work-orders/work-order.entity';

@Injectable()
export class WorkOrderEventsPublisher {
  private readonly logger = new Logger(WorkOrderEventsPublisher.name);

  constructor(private readonly amqp: AmqpConnection) {}

  /**
   * Best-effort publish after the transaction committed. A broker outage must
   * not fail a request whose state change already happened — the price is a
   * possibly lost event (the dual-write problem; solved by the outbox pattern
   * in the hardening phase).
   */
  async publish(type: WorkOrderEventType, workOrder: WorkOrder): Promise<void> {
    const event: WorkOrderEvent = {
      eventId: randomUUID(),
      type,
      occurredAt: new Date().toISOString(),
      data: {
        workOrderId: workOrder.id,
        propertyId: workOrder.propertyId,
        title: workOrder.title,
        priority: workOrder.priority,
        status: workOrder.status,
        assigneeId: workOrder.assigneeId,
      },
    };

    try {
      await this.amqp.publish(EXCHANGES.EVENTS, type, event, {
        persistent: true,
        messageId: event.eventId,
      });
    } catch (error) {
      this.logger.error(
        `failed to publish ${type} for work order ${workOrder.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
