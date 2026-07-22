import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { WorkOrderEvent, WorkOrderEventType } from '@app/contracts';
import { currentRequestId } from '@app/observability';
import { WorkOrder } from '../work-orders/work-order.entity';
import { OutboxEvent } from './outbox-event.entity';

/**
 * Builds the event envelope at write time (so the ambient correlation id and
 * domain timestamp are captured in the request context) and stages it in the
 * outbox using the caller's transaction. Publishing is the relay's job.
 */
@Injectable()
export class WorkOrderEventsOutbox {
  async stage(
    manager: EntityManager,
    type: WorkOrderEventType,
    workOrder: WorkOrder,
  ): Promise<void> {
    const event: WorkOrderEvent = {
      eventId: randomUUID(),
      type,
      occurredAt: new Date().toISOString(),
      correlationId: currentRequestId() ?? null,
      data: {
        workOrderId: workOrder.id,
        propertyId: workOrder.propertyId,
        title: workOrder.title,
        description: workOrder.description,
        priority: workOrder.priority,
        status: workOrder.status,
        assigneeId: workOrder.assigneeId,
        triage:
          workOrder.triageCategory && workOrder.triageUrgency
            ? {
                category: workOrder.triageCategory,
                urgency: workOrder.triageUrgency,
                reasoning: workOrder.triageReasoning ?? '',
              }
            : null,
      },
    };

    await manager.insert(OutboxEvent, {
      eventId: event.eventId,
      type,
      payload: event,
    });
  }
}
