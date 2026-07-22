import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { WORK_ORDER_EVENTS, WorkOrderTriage } from '@app/contracts';
import { WorkOrderEventsOutbox } from '../messaging/work-order-events.outbox';
import { WorkOrder } from '../work-orders/work-order.entity';
import { TriageService } from './triage.service';

describe('TriageService', () => {
  let service: TriageService;
  let repository: { findOneBy: jest.Mock };
  let manager: { save: jest.Mock };
  let outbox: { stage: jest.Mock };

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
    repository = { findOneBy: jest.fn() };
    manager = { save: jest.fn().mockImplementation((wo: WorkOrder) => wo) };
    const dataSource = {
      transaction: jest.fn((cb: (m: EntityManager) => unknown): unknown =>
        cb(manager as unknown as EntityManager),
      ),
    };
    outbox = { stage: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TriageService,
        { provide: getRepositoryToken(WorkOrder), useValue: repository },
        { provide: DataSource, useValue: dataSource },
        { provide: WorkOrderEventsOutbox, useValue: outbox },
      ],
    }).compile();

    service = module.get(TriageService);
  });

  it('stores the classification and stages work-order.triaged atomically', async () => {
    const order = workOrder();
    repository.findOneBy.mockResolvedValue(order);

    await service.apply(order.id, triage);

    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        triageCategory: 'plumbing',
        triageUrgency: 'high',
        triageReasoning: triage.reasoning,
        triagedAt: expect.any(Date) as Date,
      }),
    );
    expect(outbox.stage).toHaveBeenCalledWith(
      manager,
      WORK_ORDER_EVENTS.TRIAGED,
      expect.objectContaining({ id: order.id }),
    );
  });

  it('drops the triage when the work order no longer exists', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await service.apply('missing-id', triage);

    expect(manager.save).not.toHaveBeenCalled();
    expect(outbox.stage).not.toHaveBeenCalled();
  });

  it('skips an already-triaged order (duplicate created event)', async () => {
    const order = workOrder();
    order.triagedAt = new Date('2026-07-21T10:00:00.000Z');
    repository.findOneBy.mockResolvedValue(order);

    await service.apply(order.id, triage);

    expect(manager.save).not.toHaveBeenCalled();
    expect(outbox.stage).not.toHaveBeenCalled();
  });
});
