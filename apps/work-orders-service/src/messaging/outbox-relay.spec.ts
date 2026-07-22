import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import { EXCHANGES, WORK_ORDER_EVENTS } from '@app/contracts';
import { OutboxEvent } from './outbox-event.entity';
import { OutboxRelay } from './outbox-relay';
import { WorkOrderAuditProducer } from './work-order-audit.producer';

describe('OutboxRelay', () => {
  let relay: OutboxRelay;
  let amqp: { publish: jest.Mock };
  let audit: { record: jest.Mock };
  let manager: {
    getRepository: jest.Mock;
    update: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let getMany: jest.Mock;

  const row = (id: string): OutboxEvent => ({
    id,
    eventId: `00000000-0000-4000-8000-${id.padStart(12, '0')}`,
    type: WORK_ORDER_EVENTS.CREATED,
    payload: {
      eventId: `00000000-0000-4000-8000-${id.padStart(12, '0')}`,
      type: WORK_ORDER_EVENTS.CREATED,
      occurredAt: '2026-07-22T10:00:00.000Z',
      correlationId: null,
      data: {
        workOrderId: '55555555-5555-4555-8555-555555555555',
        propertyId: '11111111-1111-4111-8111-111111111111',
        title: 'Leaking tap',
        description: 'Drip',
        priority: 'medium',
        status: 'open',
        assigneeId: null,
      },
    },
    createdAt: new Date(),
    publishedAt: null,
  });

  beforeEach(async () => {
    getMany = jest.fn().mockResolvedValue([]);
    const queryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      setOnLocked: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany,
    };
    manager = {
      getRepository: jest
        .fn()
        .mockReturnValue({ createQueryBuilder: () => queryBuilder }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = {
      transaction: jest.fn((cb: (m: EntityManager) => unknown): unknown =>
        cb(manager as unknown as EntityManager),
      ),
    };
    amqp = { publish: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxRelay,
        { provide: DataSource, useValue: dataSource },
        { provide: AmqpConnection, useValue: amqp },
        { provide: WorkOrderAuditProducer, useValue: audit },
      ],
    }).compile();

    relay = module.get(OutboxRelay);
  });

  it('publishes each staged row to both brokers and marks it published', async () => {
    const staged = row('1');
    getMany.mockResolvedValue([staged]);

    await relay.drain();

    expect(amqp.publish).toHaveBeenCalledWith(
      EXCHANGES.EVENTS,
      staged.type,
      staged.payload,
      expect.objectContaining({ persistent: true, messageId: staged.eventId }),
    );
    expect(audit.record).toHaveBeenCalledWith(staged.payload);
    expect(manager.update).toHaveBeenCalledWith(
      OutboxEvent,
      staged.id,
      expect.objectContaining({ publishedAt: expect.any(Date) as Date }),
    );
  });

  it('leaves rows unpublished when a broker fails (retried next tick)', async () => {
    getMany.mockResolvedValue([row('1')]);
    amqp.publish.mockRejectedValue(new Error('broker down'));

    await expect(relay.drain()).resolves.toBeUndefined();

    expect(manager.update).not.toHaveBeenCalled();
  });

  it('does nothing when the outbox tail is empty', async () => {
    await relay.drain();

    expect(amqp.publish).not.toHaveBeenCalled();
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('logs and retries when the failure is not an Error instance', async () => {
    getMany.mockRejectedValue('connection reset');

    await expect(relay.drain()).resolves.toBeUndefined();

    expect(manager.update).not.toHaveBeenCalled();
  });

  it('skips a tick while the previous drain is still running', async () => {
    (relay as unknown as { draining: boolean }).draining = true;

    await relay.drain();

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  describe('polling lifecycle', () => {
    const originalPollMs = process.env.OUTBOX_POLL_MS;

    afterEach(() => {
      relay.onModuleDestroy();
      jest.useRealTimers();
      if (originalPollMs === undefined) delete process.env.OUTBOX_POLL_MS;
      else process.env.OUTBOX_POLL_MS = originalPollMs;
    });

    it('drains on the default 500ms cadence when OUTBOX_POLL_MS is unset', async () => {
      jest.useFakeTimers();
      delete process.env.OUTBOX_POLL_MS;

      relay.onApplicationBootstrap();
      await jest.advanceTimersByTimeAsync(499);
      expect(dataSource.transaction).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });

    it('honors the OUTBOX_POLL_MS override', async () => {
      jest.useFakeTimers();
      process.env.OUTBOX_POLL_MS = '50';

      relay.onApplicationBootstrap();
      await jest.advanceTimersByTimeAsync(150);

      expect(dataSource.transaction).toHaveBeenCalledTimes(3);
    });

    it('stops polling once the module is destroyed', () => {
      jest.useFakeTimers();
      delete process.env.OUTBOX_POLL_MS;

      relay.onApplicationBootstrap();
      relay.onModuleDestroy();
      jest.advanceTimersByTime(10_000);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('tolerates a destroy before bootstrap (no timer yet)', () => {
      expect(() => relay.onModuleDestroy()).not.toThrow();
    });
  });

  describe('decorator metadata (ts-jest emit)', () => {
    it('falls back to Object param types when dependencies are not loadable', () => {
      jest.isolateModules(() => {
        jest.doMock('typeorm', () => ({}));
        jest.doMock('@golevelup/nestjs-rabbitmq', () => ({}));
        jest.doMock('@nestjs/common', () => ({
          Injectable: () => () => undefined,
          Logger: class {},
        }));
        jest.doMock('@app/contracts', () => ({}));
        jest.doMock('./outbox-event.entity', () => ({}));
        jest.doMock('./work-order-audit.producer', () => ({}));

        const mod =
          jest.requireActual<typeof import('./outbox-relay')>('./outbox-relay');
        const paramTypes: unknown = Reflect.getMetadata(
          'design:paramtypes',
          mod.OutboxRelay,
        );

        expect(paramTypes).toEqual([Object, Object, Object]);
      });
      jest.dontMock('typeorm');
      jest.dontMock('@golevelup/nestjs-rabbitmq');
      jest.dontMock('@nestjs/common');
      jest.dontMock('@app/contracts');
      jest.dontMock('./outbox-event.entity');
      jest.dontMock('./work-order-audit.producer');
    });
  });
});
