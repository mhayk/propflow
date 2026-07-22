import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WORK_ORDER_EVENTS, WorkOrderTriage } from '@app/contracts';
import { WorkOrderEventsPublisher } from '../messaging/work-order-events.publisher';
import { WorkOrder } from '../work-orders/work-order.entity';

@Injectable()
export class TriageService {
  private readonly logger = new Logger(TriageService.name);

  constructor(
    @InjectRepository(WorkOrder)
    private readonly repository: Repository<WorkOrder>,
    private readonly events: WorkOrderEventsPublisher,
  ) {}

  async apply(workOrderId: string, triage: WorkOrderTriage): Promise<void> {
    const workOrder = await this.repository.findOneBy({ id: workOrderId });
    if (!workOrder) {
      // The order can be gone by the time the event is consumed; nothing to do.
      this.logger.warn(`work order ${workOrderId} not found, dropping triage`);
      return;
    }
    if (workOrder.triagedAt) {
      // Duplicate delivery of work-order.created — triage already applied.
      this.logger.debug(`work order ${workOrderId} already triaged, skipping`);
      return;
    }

    workOrder.triageCategory = triage.category;
    workOrder.triageUrgency = triage.urgency;
    workOrder.triageReasoning = triage.reasoning;
    workOrder.triagedAt = new Date();
    const saved = await this.repository.save(workOrder);

    await this.events.publish(WORK_ORDER_EVENTS.TRIAGED, saved);
    this.logger.log(
      `work order ${workOrderId} triaged as ${triage.category}/${triage.urgency}`,
    );
  }
}
