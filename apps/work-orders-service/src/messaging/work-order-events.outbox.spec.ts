import { EntityManager } from 'typeorm';
import { WORK_ORDER_EVENTS } from '@app/contracts';
import { runWithRequestContext } from '@app/observability';
import { WorkOrder } from '../work-orders/work-order.entity';
import {
  WorkOrderPriority,
  WorkOrderStatus,
} from '../work-orders/work-order.enums';
import { OutboxEvent } from './outbox-event.entity';
import { WorkOrderEventsOutbox } from './work-order-events.outbox';

describe('WorkOrderEventsOutbox', () => {
  const outbox = new WorkOrderEventsOutbox();
  let manager: { insert: jest.Mock };

  const workOrder = {
    id: '55555555-5555-4555-8555-555555555555',
    title: 'Leaking tap',
    description: 'Drip',
    propertyId: '11111111-1111-4111-8111-111111111111',
    priority: WorkOrderPriority.MEDIUM,
    status: WorkOrderStatus.OPEN,
    assigneeId: null,
    triageCategory: null,
    triageUrgency: null,
    triageReasoning: null,
    triagedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as WorkOrder;

  beforeEach(() => {
    manager = { insert: jest.fn().mockResolvedValue(undefined) };
  });

  const stage = () =>
    outbox.stage(
      manager as unknown as EntityManager,
      WORK_ORDER_EVENTS.CREATED,
      workOrder,
    );

  it('stages a full envelope through the given transaction manager', async () => {
    await stage();

    expect(manager.insert).toHaveBeenCalledWith(
      OutboxEvent,
      expect.objectContaining({
        type: WORK_ORDER_EVENTS.CREATED,
        payload: expect.objectContaining({
          type: WORK_ORDER_EVENTS.CREATED,
          data: expect.objectContaining({
            workOrderId: workOrder.id,
            description: workOrder.description,
            triage: null,
          }) as object,
        }) as object,
      }),
    );
  });

  it('stamps the ambient request id and actor from the request context', async () => {
    await runWithRequestContext(
      { requestId: 'req-123', userId: 'manager@propflow.dev' },
      () => stage(),
    );

    const [, staged] = manager.insert.mock.calls[0] as [
      unknown,
      { payload: { correlationId: string | null; actorId: string | null } },
    ];
    expect(staged.payload.correlationId).toBe('req-123');
    expect(staged.payload.actorId).toBe('manager@propflow.dev');
  });

  it('stages a null actor outside any request (system-initiated events)', async () => {
    await stage();

    const [, staged] = manager.insert.mock.calls[0] as [
      unknown,
      { payload: { actorId: string | null } },
    ];
    expect(staged.payload.actorId).toBeNull();
  });

  const stagedTriage = (): unknown => {
    const [, staged] = manager.insert.mock.calls[0] as [
      unknown,
      { payload: { data: { triage: unknown } } },
    ];
    return staged.payload.data.triage;
  };

  it('embeds the triage block once category and urgency are present', async () => {
    const triaged = {
      ...workOrder,
      triageCategory: 'plumbing',
      triageUrgency: 'high',
      triageReasoning: 'Active leak causing water damage.',
    } as WorkOrder;

    await outbox.stage(
      manager as unknown as EntityManager,
      WORK_ORDER_EVENTS.TRIAGED,
      triaged,
    );

    expect(stagedTriage()).toEqual({
      category: 'plumbing',
      urgency: 'high',
      reasoning: 'Active leak causing water damage.',
    });
  });

  it('defaults the triage reasoning to an empty string when it is null', async () => {
    const triaged = {
      ...workOrder,
      triageCategory: 'plumbing',
      triageUrgency: 'high',
      triageReasoning: null,
    } as WorkOrder;

    await outbox.stage(
      manager as unknown as EntityManager,
      WORK_ORDER_EVENTS.TRIAGED,
      triaged,
    );

    expect(stagedTriage()).toEqual({
      category: 'plumbing',
      urgency: 'high',
      reasoning: '',
    });
  });

  it('keeps triage null while only one of category/urgency is set', async () => {
    const halfTriaged = {
      ...workOrder,
      triageCategory: 'plumbing',
      triageUrgency: null,
    } as WorkOrder;

    await outbox.stage(
      manager as unknown as EntityManager,
      WORK_ORDER_EVENTS.CREATED,
      halfTriaged,
    );

    expect(stagedTriage()).toBeNull();
  });
});
