import 'reflect-metadata';
import { OutboxEvent } from './outbox-event.entity';

/**
 * ts-jest transpiles file-by-file, so `emitDecoratorMetadata` emits guarded
 * ternaries (`typeof Date === 'function' ? Date : Object`) for the timestamp
 * columns. The flip spec loads the module without the Date global to execute
 * the fallback side of that emitted guard.
 */
describe('OutboxEvent entity', () => {
  it('is a plain instantiable class', () => {
    const row = new OutboxEvent();
    row.type = 'work-order.created';
    row.publishedAt = null;

    expect(row).toBeInstanceOf(OutboxEvent);
    expect(row.publishedAt).toBeNull();
  });

  it('records the Date constructor as the design type of created_at', () => {
    const createdAtType: unknown = Reflect.getMetadata(
      'design:type',
      OutboxEvent.prototype,
      'createdAt',
    );

    expect(createdAtType).toBe(Date);
  });

  it('falls back to Object for timestamp columns when Date is unavailable at load time', () => {
    const decorator = () => () => undefined;
    jest.isolateModules(() => {
      jest.doMock('typeorm', () => ({
        Entity: decorator,
        Column: decorator,
        Index: decorator,
        PrimaryGeneratedColumn: decorator,
        CreateDateColumn: decorator,
      }));

      const globalRef = globalThis as { Date?: DateConstructor };
      const realDate = globalRef.Date;
      globalRef.Date = undefined;
      try {
        const mod = jest.requireActual<typeof import('./outbox-event.entity')>(
          './outbox-event.entity',
        );
        const createdAtType: unknown = Reflect.getMetadata(
          'design:type',
          mod.OutboxEvent.prototype,
          'createdAt',
        );

        expect(createdAtType).toBe(Object);
      } finally {
        globalRef.Date = realDate;
      }
    });
    jest.dontMock('typeorm');
  });
});
