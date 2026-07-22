import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { EXCHANGES, WORK_ORDER_EVENTS } from '@app/contracts';
import type { WorkOrderEvent } from '@app/contracts';
import { TriageClassifier } from './triage-classifier';
import { TriageService } from './triage.service';

export const TRIAGE_QUEUE = 'work-orders.triage';

/**
 * Triage rides the same event that fans out to notifications — the service
 * reacts to its own domain event instead of classifying inline, so the write
 * path never waits on (or fails with) the LLM call. No retry/DLQ here on
 * purpose: a failed classification returns null rather than throwing, and
 * re-running a paid, non-deterministic call on redelivery buys little.
 */
@Injectable()
export class WorkOrderTriageConsumer {
  private readonly logger = new Logger(WorkOrderTriageConsumer.name);

  constructor(
    private readonly classifier: TriageClassifier,
    private readonly triage: TriageService,
  ) {}

  @RabbitSubscribe({
    exchange: EXCHANGES.EVENTS,
    routingKey: WORK_ORDER_EVENTS.CREATED,
    queue: TRIAGE_QUEUE,
    queueOptions: { durable: true },
  })
  async onWorkOrderCreated(event: WorkOrderEvent): Promise<void> {
    const triage = await this.classifier.classify({
      title: event.data.title,
      description: event.data.description,
      priority: event.data.priority,
    });

    if (!triage) {
      this.logger.warn(
        `no classification for work order ${event.data.workOrderId}, skipping`,
      );
      return;
    }
    await this.triage.apply(event.data.workOrderId, triage);
  }
}
