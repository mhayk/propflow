import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { Property } from './property.entity';

describe('Property entity', () => {
  it('registers the properties table with typeorm', () => {
    const table = getMetadataArgsStorage().tables.find(
      (t) => t.target === Property,
    );

    expect(table?.name).toBe('properties');
  });

  it('maps camelCase fields to snake_case columns', () => {
    const columns = getMetadataArgsStorage()
      .columns.filter((c) => c.target === Property)
      .map((c) => [c.propertyName, c.options.name]);

    expect(columns).toEqual(
      expect.arrayContaining([
        ['addressLine1', 'address_line1'],
        ['managerEmail', 'manager_email'],
        ['createdAt', 'created_at'],
        ['updatedAt', 'updated_at'],
      ]),
    );
  });

  it('emits Date as the design type of the timestamp columns', () => {
    expect(
      Reflect.getMetadata('design:type', Property.prototype, 'createdAt'),
    ).toBe(Date);
    expect(
      Reflect.getMetadata('design:type', Property.prototype, 'updatedAt'),
    ).toBe(Date);
  });

  it('falls back to Object metadata when Date is not defined at load time', () => {
    // emitDecoratorMetadata guards every serialized type reference with
    // `typeof X !== "undefined" ? X : Object`; re-evaluate the module with the
    // global Date removed to execute the fallback side of that guard.
    const typeorm = jest.requireActual<typeof import('typeorm')>('typeorm');
    let isolated: typeof import('./property.entity') | undefined;

    jest.isolateModules(() => {
      jest.doMock('typeorm', () => typeorm);
      const globals = globalThis as { Date?: DateConstructor };
      const originalDate = globals.Date;
      delete globals.Date;
      try {
        isolated =
          jest.requireActual<typeof import('./property.entity')>(
            './property.entity',
          );
      } finally {
        globals.Date = originalDate;
      }
    });
    jest.dontMock('typeorm');

    expect(isolated).toBeDefined();
    expect(
      Reflect.getMetadata(
        'design:type',
        (isolated as typeof import('./property.entity')).Property.prototype,
        'createdAt',
      ),
    ).toBe(Object);
  });
});
