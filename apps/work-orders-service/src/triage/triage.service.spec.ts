import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WORK_ORDER_EVENTS, WorkOrderTriage } from '@app/contracts';
import { WorkOrderEventsPublisher } from '../messaging/work-order-events.publisher';
import { WorkOrder } from '../work-orders/work-order.entity';
import { TriageService } from './triage.service';

describe('TriageService', () => {
  let service: TriageService;
  let repository: { findOneBy: jest.Mock; save: jest.Mock };
  let events: { publish: jest.Mock };

  const triage: WorkOrderTriage = {
    category: 'plumbing',
    urgency: 'high',
    reasoning: 'Active leak causing water damage.',
  };

  const workOrder = () =>
    ({
      id: '55555555-5555-4555-8555-555555555555',
      triageCategory: null,
      triageUrgency: null,
      triageReasoning: null,
      triagedAt: null,
    }) as WorkOrder;

  beforeEach(async () => {
    repository = {
      findOneBy: jest.fn(),
      save: jest.fn().mockImplementation((entity: WorkOrder) => entity),
    };
    events = { publish: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TriageService,
        { provide: getRepositoryToken(WorkOrder), useValue: repository },
        { provide: WorkOrderEventsPublisher, useValue: events },
      ],
    }).compile();

    service = module.get(TriageService);
  });

  it('stores the classification and publishes work-order.triaged', async () => {
    const order = workOrder();
    repository.findOneBy.mockResolvedValue(order);

    await service.apply(order.id, triage);

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        triageCategory: 'plumbing',
        triageUrgency: 'high',
        triageReasoning: triage.reasoning,
        triagedAt: expect.any(Date) as Date,
      }),
    );
    expect(events.publish).toHaveBeenCalledWith(
      WORK_ORDER_EVENTS.TRIAGED,
      expect.objectContaining({ id: order.id }),
    );
  });

  it('drops the triage when the work order no longer exists', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await service.apply('missing-id', triage);

    expect(repository.save).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('skips an already-triaged order (duplicate created event)', async () => {
    const order = workOrder();
    order.triagedAt = new Date('2026-07-21T10:00:00.000Z');
    repository.findOneBy.mockResolvedValue(order);

    await service.apply(order.id, triage);

    expect(repository.save).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });
});
