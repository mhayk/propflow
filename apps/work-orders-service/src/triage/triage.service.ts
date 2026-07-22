import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { WORK_ORDER_EVENTS, WorkOrderTriage } from '@app/contracts';
import { WorkOrderEventsOutbox } from '../messaging/work-order-events.outbox';
import { WorkOrder } from '../work-orders/work-order.entity';

@Injectable()
export class TriageService {
  private readonly logger = new Logger(TriageService.name);

  constructor(
    @InjectRepository(WorkOrder)
    private readonly repository: Repository<WorkOrder>,
    private readonly dataSource: DataSource,
    private readonly outbox: WorkOrderEventsOutbox,
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

    // Same atomic pair as the write path: triage columns and the triaged
    // event commit together through the outbox.
    await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(workOrder);
      await this.outbox.stage(manager, WORK_ORDER_EVENTS.TRIAGED, saved);
    });

    this.logger.log(
      `work order ${workOrderId} triaged as ${triage.category}/${triage.urgency}`,
    );
  }
}
