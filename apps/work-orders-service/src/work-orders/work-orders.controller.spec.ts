import { Test, TestingModule } from '@nestjs/testing';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { PaginatedResult } from './dto/paginated-result';
import { QueryWorkOrdersDto } from './dto/query-work-orders.dto';
import { WorkOrder } from './work-order.entity';
import { WorkOrderPriority, WorkOrderStatus } from './work-order.enums';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersService } from './work-orders.service';

describe('WorkOrdersController', () => {
  let controller: WorkOrdersController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    assign: jest.Mock;
    updateStatus: jest.Mock;
  };

  const workOrder = {
    id: '5b4f2a54-0000-4000-8000-000000000001',
    title: 'Leaking tap in kitchen',
    description: 'Constant drip under the sink',
    propertyId: '5b4f2a54-0000-4000-8000-000000000002',
    priority: WorkOrderPriority.MEDIUM,
    status: WorkOrderStatus.OPEN,
    assigneeId: null,
  } as WorkOrder;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      assign: jest.fn(),
      updateStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkOrdersController],
      providers: [{ provide: WorkOrdersService, useValue: service }],
    }).compile();

    controller = module.get(WorkOrdersController);
  });

  it('delegates creation to the service', async () => {
    const dto: CreateWorkOrderDto = {
      title: workOrder.title,
      description: workOrder.description,
      propertyId: workOrder.propertyId,
    };
    service.create.mockResolvedValue(workOrder);

    await expect(controller.create(dto)).resolves.toBe(workOrder);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('delegates listing with the parsed query', async () => {
    const query = Object.assign(new QueryWorkOrdersDto(), {
      status: WorkOrderStatus.OPEN,
    });
    const page: PaginatedResult<WorkOrder> = {
      data: [workOrder],
      meta: { page: 1, limit: 20, total: 1 },
    };
    service.findAll.mockResolvedValue(page);

    await expect(controller.findAll(query)).resolves.toBe(page);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('delegates single lookups by id', async () => {
    service.findOne.mockResolvedValue(workOrder);

    await expect(controller.findOne(workOrder.id)).resolves.toBe(workOrder);
    expect(service.findOne).toHaveBeenCalledWith(workOrder.id);
  });

  it('delegates assignment with the assignee from the body', async () => {
    const assigneeId = '5b4f2a54-0000-4000-8000-000000000009';
    service.assign.mockResolvedValue(workOrder);

    await expect(controller.assign(workOrder.id, { assigneeId })).resolves.toBe(
      workOrder,
    );
    expect(service.assign).toHaveBeenCalledWith(workOrder.id, assigneeId);
  });

  it('delegates status updates with the status from the body', async () => {
    service.updateStatus.mockResolvedValue(workOrder);

    await expect(
      controller.updateStatus(workOrder.id, {
        status: WorkOrderStatus.CANCELLED,
      }),
    ).resolves.toBe(workOrder);
    expect(service.updateStatus).toHaveBeenCalledWith(
      workOrder.id,
      WorkOrderStatus.CANCELLED,
    );
  });

  // ts-jest transpiles file-by-file, so `emitDecoratorMetadata` guards every
  // imported/global design type with `typeof X === 'function' ? X : Object`;
  // loading the module without those values executes the fallback sides.
  describe('decorator metadata (ts-jest emit)', () => {
    it('falls back to Object metadata when dependencies and Promise are not loadable', () => {
      const decorator = () => () => undefined;
      jest.isolateModules(() => {
        jest.doMock('@nestjs/common', () => ({
          Controller: decorator,
          Get: decorator,
          Post: decorator,
          Patch: decorator,
          Body: decorator,
          Param: decorator,
          Query: decorator,
          ParseUUIDPipe: class {},
        }));
        jest.doMock('./dto/assign-work-order.dto', () => ({}));
        jest.doMock('./dto/create-work-order.dto', () => ({}));
        jest.doMock('./dto/update-work-order-status.dto', () => ({}));
        jest.doMock('./dto/paginated-result', () => ({}));
        jest.doMock('./dto/query-work-orders.dto', () => ({}));
        jest.doMock('./work-order.entity', () => ({}));
        jest.doMock('./work-orders.service', () => ({}));

        const globalRef = globalThis as { Promise?: PromiseConstructor };
        const realPromise = globalRef.Promise;
        globalRef.Promise = undefined;
        try {
          const mod = jest.requireActual<
            typeof import('./work-orders.controller')
          >('./work-orders.controller');
          const paramTypes: unknown = Reflect.getMetadata(
            'design:paramtypes',
            mod.WorkOrdersController,
          );
          const createParamTypes: unknown = Reflect.getMetadata(
            'design:paramtypes',
            mod.WorkOrdersController.prototype,
            'create',
          );
          const createReturnType: unknown = Reflect.getMetadata(
            'design:returntype',
            mod.WorkOrdersController.prototype,
            'create',
          );

          expect(paramTypes).toEqual([Object]);
          expect(createParamTypes).toEqual([Object]);
          expect(createReturnType).toBe(Object);
        } finally {
          globalRef.Promise = realPromise;
        }
      });
      jest.dontMock('@nestjs/common');
      jest.dontMock('./dto/assign-work-order.dto');
      jest.dontMock('./dto/create-work-order.dto');
      jest.dontMock('./dto/update-work-order-status.dto');
      jest.dontMock('./dto/paginated-result');
      jest.dontMock('./dto/query-work-orders.dto');
      jest.dontMock('./work-order.entity');
      jest.dontMock('./work-orders.service');
    });
  });
});
