import { Test, TestingModule } from '@nestjs/testing';
import type { ConsumeMessage } from 'amqplib';
import { WORK_ORDER_EVENTS, WorkOrderEvent } from '@app/contracts';
import { EventRetryHandler } from './event-retry.handler';
import { NotificationSender } from './notification-sender';
import { WorkOrderEventsConsumer } from './work-order-events.consumer';

describe('WorkOrderEventsConsumer', () => {
  let consumer: WorkOrderEventsConsumer;
  let sender: { send: jest.Mock };

  const message = {
    properties: { headers: {} },
  } as unknown as ConsumeMessage;

  // Pass-through: retry behaviour itself is covered in event-retry.handler.spec
  const retryStub = {
    handle: (
      _queue: string,
      _event: object,
      _message: ConsumeMessage,
      handler: () => Promise<void>,
    ) => handler(),
  };

  const event = (type: WorkOrderEvent['type']): WorkOrderEvent => ({
    eventId: '44444444-4444-4444-8444-444444444444',
    type,
    occurredAt: '2026-07-21T10:00:00.000Z',
    correlationId: null,
    data: {
      workOrderId: '55555555-5555-4555-8555-555555555555',
      propertyId: '11111111-1111-4111-8111-111111111111',
      title: 'Leaking tap in kitchen',
      description: 'Constant drip under the sink',
      priority: 'high',
      status: 'open',
      assigneeId: null,
    },
  });

  beforeEach(async () => {
    sender = { send: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkOrderEventsConsumer,
        { provide: NotificationSender, useValue: sender },
        { provide: EventRetryHandler, useValue: retryStub },
      ],
    }).compile();

    consumer = module.get(WorkOrderEventsConsumer);
  });

  it('notifies the property manager when a work order is created', async () => {
    await consumer.onWorkOrderCreated(
      event(WORK_ORDER_EVENTS.CREATED),
      message,
    );

    expect(sender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'manager-of-11111111-1111-4111-8111-111111111111',
        subject: expect.stringContaining('Leaking tap in kitchen') as string,
      }),
    );
  });

  it('notifies the tenant when a work order is completed', async () => {
    await consumer.onWorkOrderCompleted(
      event(WORK_ORDER_EVENTS.COMPLETED),
      message,
    );

    expect(sender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'tenant-of-11111111-1111-4111-8111-111111111111',
        subject: expect.stringContaining('completed') as string,
      }),
    );
  });
});
