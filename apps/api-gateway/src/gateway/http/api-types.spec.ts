import {
  ActivityEventDto,
  ActivityPage,
  AssignWorkOrderRequest,
  CreatePropertyRequest,
  CreateWorkOrderRequest,
  PageMeta,
  PropertyDto,
  PropertyPage,
  PropertySummaryDto,
  UpdateWorkOrderStatusRequest,
  WorkOrderDto,
  WorkOrderPage,
} from './api-types';

/**
 * The classes here exist for their decorators (the published OpenAPI
 * contract); instantiating them executes those decorated declarations.
 */
describe('api-types', () => {
  it('models a work order', () => {
    const workOrder = Object.assign(new WorkOrderDto(), {
      id: '22222222-2222-4222-8222-222222222222',
      status: 'open',
      triageCategory: null,
    });

    expect(workOrder).toBeInstanceOf(WorkOrderDto);
    expect(workOrder.status).toBe('open');
    expect(workOrder.triageCategory).toBeNull();
  });

  it('models a property', () => {
    const property = Object.assign(new PropertyDto(), {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Riverside House',
    });

    expect(property).toBeInstanceOf(PropertyDto);
    expect(property.name).toBe('Riverside House');
  });

  it('models an activity event', () => {
    const event = Object.assign(new ActivityEventDto(), {
      id: '42',
      eventType: 'work-order.created',
      actorId: null,
    });

    expect(event).toBeInstanceOf(ActivityEventDto);
    expect(event.eventType).toBe('work-order.created');
    expect(event.actorId).toBeNull();
  });

  it('models pagination shapes', () => {
    const meta = Object.assign(new PageMeta(), {
      page: 1,
      limit: 20,
      total: 1,
    });
    const workOrderPage = Object.assign(new WorkOrderPage(), {
      data: [],
      meta,
    });
    const propertyPage = Object.assign(new PropertyPage(), { data: [], meta });
    const activityPage = Object.assign(new ActivityPage(), {
      data: [],
      nextCursor: null,
    });

    expect(workOrderPage.meta.total).toBe(1);
    expect(propertyPage.data).toEqual([]);
    expect(activityPage.nextCursor).toBeNull();
  });

  it('models the composed property summary', () => {
    const summary = Object.assign(new PropertySummaryDto(), {
      property: new PropertyDto(),
      workOrders: null,
      workOrdersAvailable: false,
    });

    expect(summary.workOrders).toBeNull();
    expect(summary.workOrdersAvailable).toBe(false);
  });

  it('models the request bodies', () => {
    const createWorkOrder = Object.assign(new CreateWorkOrderRequest(), {
      title: 'Leaking tap in kitchen',
      priority: 'medium',
    });
    const assign = Object.assign(new AssignWorkOrderRequest(), {
      assigneeId: '33333333-3333-4333-8333-333333333333',
    });
    const updateStatus = Object.assign(new UpdateWorkOrderStatusRequest(), {
      status: 'completed',
    });
    const createProperty = Object.assign(new CreatePropertyRequest(), {
      name: 'Riverside House',
    });

    expect(createWorkOrder.priority).toBe('medium');
    expect(assign.assigneeId).toBeDefined();
    expect(updateStatus.status).toBe('completed');
    expect(createProperty.name).toBe('Riverside House');
  });

  // The emitted design-time metadata guards every referenced type with
  // `typeof X !== "undefined" ? X : Object`; re-evaluating the module with
  // a runtime `Record` value walks the other arm of that emit for the
  // `payload: Record<string, unknown>` field.
  it('uses the runtime type when a design-time type resolves to a value', () => {
    const globalRef = globalThis as { Record?: unknown };
    const decoratorFactory = () => (): void => undefined;

    jest.doMock('@nestjs/swagger', () => ({
      ApiProperty: decoratorFactory,
      ApiPropertyOptional: decoratorFactory,
    }));

    jest.isolateModules(() => {
      globalRef.Record = class {};
      try {
        const isolated =
          jest.requireActual<typeof import('./api-types')>('./api-types');
        expect(isolated.ActivityEventDto).toBeDefined();
      } finally {
        delete globalRef.Record;
      }
    });

    jest.dontMock('@nestjs/swagger');
  });
});
