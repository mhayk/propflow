import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { PaginatedResult } from './dto/paginated-result';
import { QueryWorkOrdersDto } from './dto/query-work-orders.dto';
import { WorkOrder } from './work-order.entity';
import { WorkOrderStatus } from './work-order.enums';
import { canAssign, canTransition } from './work-order-transitions';

@Injectable()
export class WorkOrdersService {
  constructor(
    @InjectRepository(WorkOrder)
    private readonly repository: Repository<WorkOrder>,
  ) {}

  create(dto: CreateWorkOrderDto): Promise<WorkOrder> {
    const workOrder = this.repository.create(dto);
    return this.repository.save(workOrder);
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
    return this.repository.save(workOrder);
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
    return this.repository.save(workOrder);
  }
}
