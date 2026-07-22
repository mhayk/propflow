import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { WORK_ORDER_EVENTS } from '@app/contracts';
import { WorkOrderEventsOutbox } from '../messaging/work-order-events.outbox';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { QueryWorkOrdersDto } from './dto/query-work-orders.dto';
import { WorkOrder } from './work-order.entity';
import { WorkOrderPriority, WorkOrderStatus } from './work-order.enums';
import { WorkOrdersService } from './work-orders.service';

describe('WorkOrdersService', () => {
  let service: WorkOrdersService;
  let repository: jest.Mocked<
    Pick<
      Repository<WorkOrder>,
      'create' | 'save' | 'findOneBy' | 'findAndCount'
    >
  >;
  let manager: { save: jest.Mock };
  let outbox: { stage: jest.Mock };

  const workOrder = (overrides: Partial<WorkOrder> = {}): WorkOrder =>
    ({
      id: '5b4f2a54-0000-4000-8000-000000000001',
      title: 'Leaking tap in kitchen',
      description: 'Constant drip under the sink',
      propertyId: '5b4f2a54-0000-4000-8000-000000000002',
      priority: WorkOrderPriority.MEDIUM,
      status: WorkOrderStatus.OPEN,
      assigneeId: null,
      createdAt: new Date('2026-07-21T10:00:00Z'),
      updatedAt: new Date('2026-07-21T10:00:00Z'),
      ...overrides,
    }) as WorkOrder;

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      findOneBy: jest.fn(),
      findAndCount: jest.fn(),
    };
    // The transaction mock hands the fake manager to the callback, so the
    // specs can assert that save and stage happen inside the same scope.
    manager = {
      save: jest.fn().mockImplementation((wo: WorkOrder) => wo),
    };
    const dataSource = {
      transaction: jest.fn((cb: (m: EntityManager) => unknown): unknown =>
        cb(manager as unknown as EntityManager),
      ),
    };
    outbox = { stage: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkOrdersService,
        { provide: getRepositoryToken(WorkOrder), useValue: repository },
        { provide: DataSource, useValue: dataSource },
        { provide: WorkOrderEventsOutbox, useValue: outbox },
      ],
    }).compile();

    service = module.get(WorkOrdersService);
  });

  describe('create', () => {
    it('persists a new work order and stages created in the same transaction', async () => {
      const dto: CreateWorkOrderDto = {
        title: 'Leaking tap in kitchen',
        description: 'Constant drip under the sink',
        propertyId: '5b4f2a54-0000-4000-8000-000000000002',
      };
      const entity = workOrder();
      repository.create.mockReturnValue(entity);

      const result = await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith(dto);
      expect(manager.save).toHaveBeenCalledWith(entity);
      expect(result).toBe(entity);
      expect(outbox.stage).toHaveBeenCalledWith(
        manager,
        WORK_ORDER_EVENTS.CREATED,
        entity,
      );
    });
  });

  describe('findAll', () => {
    it('translates page/limit into skip/take and returns meta', async () => {
      repository.findAndCount.mockResolvedValue([[workOrder()], 42]);
      const query = Object.assign(new QueryWorkOrdersDto(), {
        page: 3,
        limit: 10,
      });

      const result = await service.findAll(query);

      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { createdAt: 'DESC' },
        skip: 20,
        take: 10,
      });
      expect(result.meta).toEqual({ page: 3, limit: 10, total: 42 });
    });

    it('only includes provided filters in the where clause', async () => {
      repository.findAndCount.mockResolvedValue([[], 0]);
      const query = Object.assign(new QueryWorkOrdersDto(), {
        status: WorkOrderStatus.OPEN,
      });

      await service.findAll(query);

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: WorkOrderStatus.OPEN } }),
      );
    });
  });

  describe('findOne', () => {
    it('returns the work order when it exists', async () => {
      const entity = workOrder();
      repository.findOneBy.mockResolvedValue(entity);

      await expect(service.findOne(entity.id)).resolves.toBe(entity);
    });

    it('throws NotFoundException when it does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('assign', () => {
    const assigneeId = '5b4f2a54-0000-4000-8000-000000000009';

    it('assigns an open work order and moves it to assigned', async () => {
      const entity = workOrder({ status: WorkOrderStatus.OPEN });
      repository.findOneBy.mockResolvedValue(entity);

      const result = await service.assign(entity.id, assigneeId);

      expect(result.status).toBe(WorkOrderStatus.ASSIGNED);
      expect(result.assigneeId).toBe(assigneeId);
      expect(outbox.stage).toHaveBeenCalledWith(
        manager,
        WORK_ORDER_EVENTS.ASSIGNED,
        result,
      );
    });

    it('allows reassignment while still assigned', async () => {
      const entity = workOrder({
        status: WorkOrderStatus.ASSIGNED,
        assigneeId: 'previous-assignee',
      });
      repository.findOneBy.mockResolvedValue(entity);

      const result = await service.assign(entity.id, assigneeId);

      expect(result.assigneeId).toBe(assigneeId);
    });

    it.each([
      WorkOrderStatus.IN_PROGRESS,
      WorkOrderStatus.COMPLETED,
      WorkOrderStatus.CANCELLED,
    ])('rejects assignment when status is %s', async (status) => {
      repository.findOneBy.mockResolvedValue(workOrder({ status }));

      await expect(service.assign('any-id', assigneeId)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(manager.save).not.toHaveBeenCalled();
      expect(outbox.stage).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it.each([
      [WorkOrderStatus.OPEN, WorkOrderStatus.CANCELLED],
      [WorkOrderStatus.ASSIGNED, WorkOrderStatus.IN_PROGRESS],
      [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.COMPLETED],
    ])('allows the transition %s -> %s', async (from, to) => {
      repository.findOneBy.mockResolvedValue(workOrder({ status: from }));

      const result = await service.updateStatus('any-id', to);

      expect(result.status).toBe(to);
    });

    it.each([
      [WorkOrderStatus.OPEN, WorkOrderStatus.COMPLETED],
      [WorkOrderStatus.OPEN, WorkOrderStatus.IN_PROGRESS],
      [WorkOrderStatus.COMPLETED, WorkOrderStatus.IN_PROGRESS],
      [WorkOrderStatus.CANCELLED, WorkOrderStatus.OPEN],
    ])('rejects the transition %s -> %s', async (from, to) => {
      repository.findOneBy.mockResolvedValue(workOrder({ status: from }));

      await expect(service.updateStatus('any-id', to)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(manager.save).not.toHaveBeenCalled();
      expect(outbox.stage).not.toHaveBeenCalled();
    });

    it.each([
      [WorkOrderStatus.IN_PROGRESS, WORK_ORDER_EVENTS.STARTED],
      [WorkOrderStatus.COMPLETED, WORK_ORDER_EVENTS.COMPLETED],
      [WorkOrderStatus.CANCELLED, WORK_ORDER_EVENTS.CANCELLED],
    ])('stages the matching event for %s', async (to, eventType) => {
      const from =
        to === WorkOrderStatus.CANCELLED
          ? WorkOrderStatus.OPEN
          : to === WorkOrderStatus.IN_PROGRESS
            ? WorkOrderStatus.ASSIGNED
            : WorkOrderStatus.IN_PROGRESS;
      repository.findOneBy.mockResolvedValue(workOrder({ status: from }));

      await service.updateStatus('any-id', to);

      expect(outbox.stage).toHaveBeenCalledWith(
        manager,
        eventType,
        expect.objectContaining({ status: to }),
      );
    });

    it('rejects moving to assigned outside the assign endpoint', async () => {
      repository.findOneBy.mockResolvedValue(
        workOrder({ status: WorkOrderStatus.OPEN }),
      );

      await expect(
        service.updateStatus('any-id', WorkOrderStatus.ASSIGNED),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
