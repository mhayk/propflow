import 'reflect-metadata';
import { WorkOrder } from './work-order.entity';
import { WorkOrderPriority, WorkOrderStatus } from './work-order.enums';

/**
 * ts-jest transpiles file-by-file, so `emitDecoratorMetadata` emits guarded
 * ternaries (`typeof X === 'function' ? X : Object`) for every imported or
 * global design type. Both sides of those guards are real emitted code; the
 * "flip" specs below load the module with a dependency of the opposite
 * runtime shape to execute the otherwise-dead side.
 */
describe('WorkOrder entity', () => {
  it('is a plain instantiable class with assignable columns', () => {
    const workOrder = new WorkOrder();
    workOrder.priority = WorkOrderPriority.LOW;
    workOrder.status = WorkOrderStatus.OPEN;

    expect(workOrder).toBeInstanceOf(WorkOrder);
    expect(workOrder.priority).toBe(WorkOrderPriority.LOW);
    expect(workOrder.status).toBe(WorkOrderStatus.OPEN);
  });

  it('records Object as the design type of enum columns (enums are objects at runtime)', () => {
    const priorityType: unknown = Reflect.getMetadata(
      'design:type',
      WorkOrder.prototype,
      'priority',
    );
    const statusType: unknown = Reflect.getMetadata(
      'design:type',
      WorkOrder.prototype,
      'status',
    );

    expect(priorityType).toBe(Object);
    expect(statusType).toBe(Object);
  });

  it('records the Date constructor as the design type of timestamp columns', () => {
    const createdAtType: unknown = Reflect.getMetadata(
      'design:type',
      WorkOrder.prototype,
      'createdAt',
    );

    expect(createdAtType).toBe(Date);
  });

  it('records the enum constructor when the enum module exports a class', () => {
    jest.isolateModules(() => {
      jest.doMock('./work-order.enums', () => ({
        WorkOrderPriority: class {
          static readonly MEDIUM = 'medium';
        },
        WorkOrderStatus: class {
          static readonly OPEN = 'open';
        },
      }));

      const mod = jest.requireActual<typeof import('./work-order.entity')>(
        './work-order.entity',
      );
      const priorityType: unknown = Reflect.getMetadata(
        'design:type',
        mod.WorkOrder.prototype,
        'priority',
      );
      const statusType: unknown = Reflect.getMetadata(
        'design:type',
        mod.WorkOrder.prototype,
        'status',
      );

      expect(typeof priorityType).toBe('function');
      expect(typeof statusType).toBe('function');
    });
    jest.dontMock('./work-order.enums');
  });

  it('falls back to Object for timestamp columns when Date is unavailable at load time', () => {
    const decorator = () => () => undefined;
    jest.isolateModules(() => {
      // Stub typeorm so the isolated load never evaluates real decorator
      // machinery while the Date global is temporarily removed.
      jest.doMock('typeorm', () => ({
        Entity: decorator,
        Column: decorator,
        Index: decorator,
        PrimaryGeneratedColumn: decorator,
        CreateDateColumn: decorator,
        UpdateDateColumn: decorator,
      }));
      jest.doMock('@app/contracts', () => ({}));

      const globalRef = globalThis as { Date?: DateConstructor };
      const realDate = globalRef.Date;
      globalRef.Date = undefined;
      try {
        const mod = jest.requireActual<typeof import('./work-order.entity')>(
          './work-order.entity',
        );
        const createdAtType: unknown = Reflect.getMetadata(
          'design:type',
          mod.WorkOrder.prototype,
          'createdAt',
        );
        const updatedAtType: unknown = Reflect.getMetadata(
          'design:type',
          mod.WorkOrder.prototype,
          'updatedAt',
        );

        expect(createdAtType).toBe(Object);
        expect(updatedAtType).toBe(Object);
      } finally {
        globalRef.Date = realDate;
      }
    });
    jest.dontMock('typeorm');
    jest.dontMock('@app/contracts');
  });
});
