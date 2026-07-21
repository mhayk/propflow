import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Test, TestingModule } from '@nestjs/testing';
import { EXCHANGES, WORK_ORDER_EVENTS, WorkOrderEvent } from '@app/contracts';
import { runWithRequestContext } from '@app/observability';
import { WorkOrder } from '../work-orders/work-order.entity';
import {
  WorkOrderPriority,
  WorkOrderStatus,
} from '../work-orders/work-order.enums';
import { WorkOrderEventsPublisher } from './work-order-events.publisher';

describe('WorkOrderEventsPublisher', () => {
  let publisher: WorkOrderEventsPublisher;
  let amqp: { publish: jest.Mock };

  const workOrder = {
    id: '55555555-5555-4555-8555-555555555555',
    title: 'Leaking tap',
    description: 'Drip',
    propertyId: '11111111-1111-4111-8111-111111111111',
    priority: WorkOrderPriority.MEDIUM,
    status: WorkOrderStatus.OPEN,
    assigneeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as WorkOrder;

  beforeEach(async () => {
    amqp = { publish: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkOrderEventsPublisher,
        { provide: AmqpConnection, useValue: amqp },
      ],
    }).compile();

    publisher = module.get(WorkOrderEventsPublisher);
  });

  it('publishes an envelope routed by event type', async () => {
    await publisher.publish(WORK_ORDER_EVENTS.CREATED, workOrder);

    expect(amqp.publish).toHaveBeenCalledWith(
      EXCHANGES.EVENTS,
      WORK_ORDER_EVENTS.CREATED,
      expect.objectContaining({
        type: WORK_ORDER_EVENTS.CREATED,
        data: expect.objectContaining({ workOrderId: workOrder.id }) as object,
      }),
      expect.objectContaining({ persistent: true }),
    );
  });

  it('stamps the ambient request id as correlationId', async () => {
    await runWithRequestContext({ requestId: 'req-123' }, () =>
      publisher.publish(WORK_ORDER_EVENTS.CREATED, workOrder),
    );

    const [, , event] = amqp.publish.mock.calls[0] as [
      string,
      string,
      WorkOrderEvent,
    ];
    expect(event.correlationId).toBe('req-123');
  });

  it('sets correlationId to null outside a request', async () => {
    await publisher.publish(WORK_ORDER_EVENTS.CREATED, workOrder);

    const [, , event] = amqp.publish.mock.calls[0] as [
      string,
      string,
      WorkOrderEvent,
    ];
    expect(event.correlationId).toBeNull();
  });

  it('swallows broker failures (best-effort publish)', async () => {
    amqp.publish.mockRejectedValue(new Error('broker down'));

    await expect(
      publisher.publish(WORK_ORDER_EVENTS.CREATED, workOrder),
    ).resolves.toBeUndefined();
  });
});
