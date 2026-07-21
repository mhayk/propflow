import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  const workOrder = (overrides: Partial<WorkOrder> = {}): WorkOrder => ({
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
  });

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      findOneBy: jest.fn(),
      findAndCount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkOrdersService,
        { provide: getRepositoryToken(WorkOrder), useValue: repository },
      ],
    }).compile();

    service = module.get(WorkOrdersService);
  });

  describe('create', () => {
    it('persists a new work order from the dto', async () => {
      const dto: CreateWorkOrderDto = {
        title: 'Leaking tap in kitchen',
        description: 'Constant drip under the sink',
        propertyId: '5b4f2a54-0000-4000-8000-000000000002',
      };
      const entity = workOrder();
      repository.create.mockReturnValue(entity);
      repository.save.mockResolvedValue(entity);

      const result = await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith(dto);
      expect(repository.save).toHaveBeenCalledWith(entity);
      expect(result).toBe(entity);
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
});
