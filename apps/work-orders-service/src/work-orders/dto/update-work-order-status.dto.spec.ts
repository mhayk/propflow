import 'reflect-metadata';
import { validate } from 'class-validator';
import { WorkOrderStatus } from '../work-order.enums';
import { UpdateWorkOrderStatusDto } from './update-work-order-status.dto';

const build = (status: unknown): UpdateWorkOrderStatusDto =>
  Object.assign(new UpdateWorkOrderStatusDto(), { status });

describe('UpdateWorkOrderStatusDto', () => {
  it.each(Object.values(WorkOrderStatus))(
    'accepts the %s status',
    async (status) => {
      await expect(validate(build(status))).resolves.toHaveLength(0);
    },
  );

  it.each([
    ['a value outside the enum', 'archived'],
    ['a missing status', undefined],
  ])('rejects %s', async (_name, status) => {
    const errors = await validate(build(status));

    expect(errors.length).toBeGreaterThan(0);
  });

  // ts-jest transpiles file-by-file, so `emitDecoratorMetadata` guards the
  // enum design type with `typeof X === 'function' ? X : Object`; loading the
  // module with a class-shaped enum executes the other side of that emit.
  it('records the enum constructor when the enum module exports a class', () => {
    jest.isolateModules(() => {
      jest.doMock('../work-order.enums', () => ({
        WorkOrderStatus: class {
          static readonly OPEN = 'open';
        },
      }));

      const mod = jest.requireActual<
        typeof import('./update-work-order-status.dto')
      >('./update-work-order-status.dto');
      const statusType: unknown = Reflect.getMetadata(
        'design:type',
        mod.UpdateWorkOrderStatusDto.prototype,
        'status',
      );

      expect(typeof statusType).toBe('function');
    });
    jest.dontMock('../work-order.enums');
  });
});
