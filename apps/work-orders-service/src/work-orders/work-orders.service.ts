import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { WORK_ORDER_EVENTS, WorkOrderEventType } from '@app/contracts';
import { WorkOrderEventsOutbox } from '../messaging/work-order-events.outbox';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { PaginatedResult } from './dto/paginated-result';
import { QueryWorkOrdersDto } from './dto/query-work-orders.dto';
import { WorkOrder } from './work-order.entity';
import { WorkOrderStatus } from './work-order.enums';
import { canAssign, canTransition } from './work-order-transitions';

/** Which domain event each externally-triggered status change produces. */
const STATUS_EVENTS: Partial<Record<WorkOrderStatus, WorkOrderEventType>> = {
  [WorkOrderStatus.IN_PROGRESS]: WORK_ORDER_EVENTS.STARTED,
  [WorkOrderStatus.COMPLETED]: WORK_ORDER_EVENTS.COMPLETED,
  [WorkOrderStatus.CANCELLED]: WORK_ORDER_EVENTS.CANCELLED,
};

@Injectable()
export class WorkOrdersService {
  constructor(
    @InjectRepository(WorkOrder)
    private readonly repository: Repository<WorkOrder>,
    private readonly dataSource: DataSource,
    private readonly outbox: WorkOrderEventsOutbox,
  ) {}

  /**
   * State change and its event commit atomically: the entity save and the
   * outbox row share one transaction, so there is no window where the state
   * changed but the event was lost (the dual-write problem, closed).
   */
  private saveAndStage(
    workOrder: WorkOrder,
    type: WorkOrderEventType,
  ): Promise<WorkOrder> {
    return this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(workOrder);
      await this.outbox.stage(manager, type, saved);
      return saved;
    });
  }

  create(dto: CreateWorkOrderDto): Promise<WorkOrder> {
    const workOrder = this.repository.create(dto);
    return this.saveAndStage(workOrder, WORK_ORDER_EVENTS.CREATED);
  }

  async findAll(
    query: QueryWorkOrdersDto,
  ): Promise<PaginatedResult<WorkOrder>> {
    const { page, limit, status, priority, propertyId } = query;

    const where: FindOptionsWhere<WorkOrder> = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (propertyId) where.propertyId = propertyId;

    const [data, total] = await this.repository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, meta: { page, limit, total } };
  }

  async findOne(id: string): Promise<WorkOrder> {
    const workOrder = await this.repository.findOneBy({ id });
    if (!workOrder) {
      throw new NotFoundException(`work order ${id} not found`);
    }
    return workOrder;
  }

  async assign(id: string, assigneeId: string): Promise<WorkOrder> {
    const workOrder = await this.findOne(id);

    if (!canAssign(workOrder.status)) {
      throw new ConflictException(
        `cannot assign a work order in status '${workOrder.status}'`,
      );
    }

    workOrder.assigneeId = assigneeId;
    workOrder.status = WorkOrderStatus.ASSIGNED;
    return this.saveAndStage(workOrder, WORK_ORDER_EVENTS.ASSIGNED);
  }

  async updateStatus(id: string, next: WorkOrderStatus): Promise<WorkOrder> {
    const workOrder = await this.findOne(id);

    if (next === WorkOrderStatus.ASSIGNED) {
      throw new ConflictException(
        `'assigned' is only reachable through the assign endpoint`,
      );
    }
    if (!canTransition(workOrder.status, next)) {
      throw new ConflictException(
        `invalid status transition '${workOrder.status}' -> '${next}'`,
      );
    }

    workOrder.status = next;

    const eventType = STATUS_EVENTS[next];
    if (eventType) {
      return this.saveAndStage(workOrder, eventType);
    }
    return this.repository.save(workOrder);
  }
}
