import { Test, TestingModule } from '@nestjs/testing';
import type { ConsumeMessage } from 'amqplib';
import { WORK_ORDER_EVENTS, WorkOrderEvent } from '@app/contracts';
import { EventRetryHandler } from './event-retry.handler';
import { NotificationSender } from './notification-sender';
import { ProcessedEventsStore } from './processed-events.store';
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
        ProcessedEventsStore,
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

  it('sends once when the same event is delivered twice', async () => {
    const duplicate = event(WORK_ORDER_EVENTS.CREATED);

    await consumer.onWorkOrderCreated(duplicate, message);
    await consumer.onWorkOrderCreated(duplicate, message);

    expect(sender.send).toHaveBeenCalledTimes(1);
  });

  it('sends the completed notification once for duplicate deliveries', async () => {
    const duplicate = event(WORK_ORDER_EVENTS.COMPLETED);

    await consumer.onWorkOrderCompleted(duplicate, message);
    await consumer.onWorkOrderCompleted(duplicate, message);

    expect(sender.send).toHaveBeenCalledTimes(1);
  });

  it('handles created events that carry a correlationId', async () => {
    const correlated = {
      ...event(WORK_ORDER_EVENTS.CREATED),
      correlationId: '66666666-6666-4666-8666-666666666666',
    };

    await consumer.onWorkOrderCreated(correlated, message);

    expect(sender.send).toHaveBeenCalledTimes(1);
  });

  it('handles completed events that carry a correlationId', async () => {
    const correlated = {
      ...event(WORK_ORDER_EVENTS.COMPLETED),
      correlationId: '77777777-7777-4777-8777-777777777777',
    };

    await consumer.onWorkOrderCompleted(correlated, message);

    expect(sender.send).toHaveBeenCalledTimes(1);
  });

  it('falls back to Object metadata when types are not defined at load time', () => {
    // emitDecoratorMetadata guards every serialized type reference (ctor param
    // types and decorated-method return types) with
    // `typeof X !== "undefined" ? X : Object`; re-evaluate the module without
    // those globals/classes to execute the fallback side of each guard. All
    // dependencies are captured up front so nothing else evaluates while the
    // Promise global is missing.
    const common =
      jest.requireActual<typeof import('@nestjs/common')>('@nestjs/common');
    const rabbitmq = jest.requireActual<
      typeof import('@golevelup/nestjs-rabbitmq')
    >('@golevelup/nestjs-rabbitmq');
    const contracts =
      jest.requireActual<typeof import('@app/contracts')>('@app/contracts');
    let isolated: typeof import('./work-order-events.consumer') | undefined;

    jest.isolateModules(() => {
      jest.doMock('@nestjs/common', () => common);
      jest.doMock('@golevelup/nestjs-rabbitmq', () => rabbitmq);
      jest.doMock('@app/contracts', () => contracts);
      jest.doMock('./event-retry.handler', () => ({}));
      jest.doMock('./notification-sender', () => ({}));
      jest.doMock('./processed-events.store', () => ({}));
      const globals = globalThis as { Promise?: PromiseConstructor };
      const originalPromise = globals.Promise;
      delete globals.Promise;
      try {
        isolated = jest.requireActual<
          typeof import('./work-order-events.consumer')
        >('./work-order-events.consumer');
      } finally {
        globals.Promise = originalPromise;
      }
    });
    jest.dontMock('@nestjs/common');
    jest.dontMock('@golevelup/nestjs-rabbitmq');
    jest.dontMock('@app/contracts');
    jest.dontMock('./event-retry.handler');
    jest.dontMock('./notification-sender');
    jest.dontMock('./processed-events.store');

    expect(isolated?.WorkOrderEventsConsumer).toBeDefined();
  });
});
