import 'reflect-metadata';
import { validate } from 'class-validator';
import { WorkOrderPriority } from '../work-order.enums';
import { CreateWorkOrderDto } from './create-work-order.dto';

const build = (
  overrides: Partial<CreateWorkOrderDto> = {},
): CreateWorkOrderDto =>
  Object.assign(new CreateWorkOrderDto(), {
    title: 'Leaking tap in kitchen',
    description: 'Constant drip under the sink',
    propertyId: '11111111-1111-4111-8111-111111111111',
    ...overrides,
  });

describe('CreateWorkOrderDto', () => {
  it('accepts a fully valid payload', async () => {
    await expect(
      validate(build({ priority: WorkOrderPriority.HIGH })),
    ).resolves.toHaveLength(0);
  });

  it('accepts an omitted priority (it is optional)', async () => {
    await expect(validate(build())).resolves.toHaveLength(0);
  });

  it.each([
    ['a title shorter than 3 characters', { title: 'ab' }],
    ['an empty description', { description: '' }],
    ['a propertyId that is not a UUID', { propertyId: 'not-a-uuid' }],
    [
      'a priority outside the enum',
      { priority: 'critical' as WorkOrderPriority },
    ],
  ])('rejects %s', async (_name, overrides) => {
    const errors = await validate(build(overrides));

    expect(errors.length).toBeGreaterThan(0);
  });

  // ts-jest transpiles file-by-file, so `emitDecoratorMetadata` guards the
  // enum design type with `typeof X === 'function' ? X : Object`; loading the
  // module with a class-shaped enum executes the other side of that emit.
  it('records the enum constructor when the enum module exports a class', () => {
    jest.isolateModules(() => {
      jest.doMock('../work-order.enums', () => ({
        WorkOrderPriority: class {
          static readonly MEDIUM = 'medium';
        },
      }));

      const mod = jest.requireActual<typeof import('./create-work-order.dto')>(
        './create-work-order.dto',
      );
      const priorityType: unknown = Reflect.getMetadata(
        'design:type',
        mod.CreateWorkOrderDto.prototype,
        'priority',
      );

      expect(typeof priorityType).toBe('function');
    });
    jest.dontMock('../work-order.enums');
  });
});
