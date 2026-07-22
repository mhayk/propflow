import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WorkOrderPriority, WorkOrderStatus } from '../work-order.enums';
import { QueryWorkOrdersDto } from './query-work-orders.dto';

describe('QueryWorkOrdersDto', () => {
  it('defaults page to 1 and limit to 20', async () => {
    const dto = plainToInstance(QueryWorkOrdersDto, {});

    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('coerces page and limit query strings to numbers', async () => {
    const dto = plainToInstance(QueryWorkOrdersDto, {
      page: '3',
      limit: '50',
    });

    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(50);
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('accepts all optional filters together', async () => {
    const dto = plainToInstance(QueryWorkOrdersDto, {
      status: WorkOrderStatus.OPEN,
      priority: WorkOrderPriority.URGENT,
      propertyId: '11111111-1111-4111-8111-111111111111',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([
    ['a status outside the enum', { status: 'archived' }],
    ['a priority outside the enum', { priority: 'critical' }],
    ['a non-UUID propertyId', { propertyId: 'building-7' }],
    ['a page below 1', { page: '0' }],
    ['a fractional page', { page: '1.5' }],
    ['a limit above 100', { limit: '101' }],
    ['a non-numeric limit', { limit: 'many' }],
  ])('rejects %s', async (_name, query) => {
    const errors = await validate(plainToInstance(QueryWorkOrdersDto, query));

    expect(errors.length).toBeGreaterThan(0);
  });

  // ts-jest transpiles file-by-file, so `emitDecoratorMetadata` guards the
  // enum design types with `typeof X === 'function' ? X : Object`; loading
  // the module with class-shaped enums executes the other side of that emit.
  it('records the enum constructors when the enum module exports classes', () => {
    jest.isolateModules(() => {
      jest.doMock('../work-order.enums', () => ({
        WorkOrderStatus: class {
          static readonly OPEN = 'open';
        },
        WorkOrderPriority: class {
          static readonly MEDIUM = 'medium';
        },
      }));

      const mod = jest.requireActual<typeof import('./query-work-orders.dto')>(
        './query-work-orders.dto',
      );
      const statusType: unknown = Reflect.getMetadata(
        'design:type',
        mod.QueryWorkOrdersDto.prototype,
        'status',
      );
      const priorityType: unknown = Reflect.getMetadata(
        'design:type',
        mod.QueryWorkOrdersDto.prototype,
        'priority',
      );

      expect(typeof statusType).toBe('function');
      expect(typeof priorityType).toBe('function');
    });
    jest.dontMock('../work-order.enums');
  });
});
