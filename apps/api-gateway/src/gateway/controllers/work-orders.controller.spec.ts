import { WorkOrdersClient } from '../clients/work-orders.client';
import { Paginated, WorkOrderDto } from '../http/api-types';
import { WorkOrdersController } from './work-orders.controller';

describe('WorkOrdersController', () => {
  let controller: WorkOrdersController;
  let client: jest.Mocked<
    Pick<
      WorkOrdersClient,
      'create' | 'list' | 'getById' | 'assign' | 'updateStatus'
    >
  >;

  const WORK_ORDER_ID = '22222222-2222-4222-8222-222222222222';
  const workOrder = { id: WORK_ORDER_ID, status: 'open' } as WorkOrderDto;
  const page: Paginated<WorkOrderDto> = {
    data: [workOrder],
    meta: { page: 1, limit: 20, total: 1 },
  };

  beforeEach(() => {
    client = {
      create: jest.fn(),
      list: jest.fn(),
      getById: jest.fn(),
      assign: jest.fn(),
      updateStatus: jest.fn(),
    };
    controller = new WorkOrdersController(
      client as unknown as WorkOrdersClient,
    );
  });

  it('delegates create to the client with the raw body', async () => {
    const body = { title: 'Leaking tap in kitchen' };
    client.create.mockResolvedValue(workOrder);

    await expect(controller.create(body)).resolves.toBe(workOrder);
    expect(client.create).toHaveBeenCalledWith(body);
  });

  it('delegates list to the client with the raw query', async () => {
    const query = { page: '1', status: 'open' };
    client.list.mockResolvedValue(page);

    await expect(controller.list(query)).resolves.toBe(page);
    expect(client.list).toHaveBeenCalledWith(query);
  });

  it('delegates getById to the client with the id', async () => {
    client.getById.mockResolvedValue(workOrder);

    await expect(controller.getById(WORK_ORDER_ID)).resolves.toBe(workOrder);
    expect(client.getById).toHaveBeenCalledWith(WORK_ORDER_ID);
  });

  it('delegates assign to the client with the id and body', async () => {
    const body = { assigneeId: '33333333-3333-4333-8333-333333333333' };
    client.assign.mockResolvedValue(workOrder);

    await expect(controller.assign(WORK_ORDER_ID, body)).resolves.toBe(
      workOrder,
    );
    expect(client.assign).toHaveBeenCalledWith(WORK_ORDER_ID, body);
  });

  it('delegates updateStatus to the client with the id and body', async () => {
    const body = { status: 'in_progress' };
    client.updateStatus.mockResolvedValue(workOrder);

    await expect(controller.updateStatus(WORK_ORDER_ID, body)).resolves.toBe(
      workOrder,
    );
    expect(client.updateStatus).toHaveBeenCalledWith(WORK_ORDER_ID, body);
  });

  // The emitted design-time metadata guards every referenced type with
  // `typeof X !== "undefined" ? X : Object`; re-evaluating the module with
  // those identifiers absent (or, for `Record`, present) walks the fallback
  // arms of that emit.
  it('degrades design-time metadata to Object when types are not runtime values', () => {
    const globalRef = globalThis as {
      Promise?: PromiseConstructor;
      Record?: unknown;
    };
    const originalPromise = globalRef.Promise;
    const decoratorFactory = () => (): void => undefined;

    jest.doMock('@nestjs/common', () => ({
      Body: decoratorFactory,
      Controller: decoratorFactory,
      Get: decoratorFactory,
      Param: decoratorFactory,
      ParseUUIDPipe: class {},
      Patch: decoratorFactory,
      Post: decoratorFactory,
      Query: decoratorFactory,
    }));
    jest.doMock('@nestjs/swagger', () => ({
      ApiBearerAuth: decoratorFactory,
      ApiBody: decoratorFactory,
      ApiCreatedResponse: decoratorFactory,
      ApiForbiddenResponse: decoratorFactory,
      ApiOkResponse: decoratorFactory,
      ApiOperation: decoratorFactory,
      ApiProperty: decoratorFactory,
      ApiPropertyOptional: decoratorFactory,
      ApiQuery: decoratorFactory,
      ApiTags: decoratorFactory,
      ApiUnauthorizedResponse: decoratorFactory,
    }));
    jest.doMock('../../auth/auth.decorators', () => ({
      Roles: decoratorFactory,
    }));
    jest.doMock('../clients/work-orders.client', () => ({}));

    jest.isolateModules(() => {
      globalRef.Record = class {};
      delete globalRef.Promise;
      try {
        const isolated = jest.requireActual<
          typeof import('./work-orders.controller')
        >('./work-orders.controller');
        expect(isolated.WorkOrdersController).toBeDefined();
      } finally {
        globalRef.Promise = originalPromise;
        delete globalRef.Record;
      }
    });

    jest.dontMock('@nestjs/common');
    jest.dontMock('@nestjs/swagger');
    jest.dontMock('../../auth/auth.decorators');
    jest.dontMock('../clients/work-orders.client');
  });
});
