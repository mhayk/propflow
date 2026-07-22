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
    const dataSource = {
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
});
