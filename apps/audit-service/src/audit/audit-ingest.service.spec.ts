import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WORK_ORDER_EVENTS, WorkOrderEvent } from '@app/contracts';
import { AuditEvent } from './audit-event.entity';
import { AuditIngestService } from './audit-ingest.service';

describe('AuditIngestService', () => {
  let service: AuditIngestService;
  let builder: {
    insert: jest.Mock;
    into: jest.Mock;
    values: jest.Mock;
    orIgnore: jest.Mock;
    execute: jest.Mock;
  };

  const event: WorkOrderEvent = {
    eventId: '44444444-4444-4444-8444-444444444444',
    type: WORK_ORDER_EVENTS.CREATED,
    occurredAt: '2026-07-21T10:00:00.000Z',
    correlationId: 'req-1',
    data: {
      workOrderId: '55555555-5555-4555-8555-555555555555',
      propertyId: '11111111-1111-4111-8111-111111111111',
      title: 'Leaking tap',
      description: 'Constant drip under the sink',
      priority: 'high',
      status: 'open',
      assigneeId: null,
    },
  };

  beforeEach(async () => {
    builder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ identifiers: [{ id: '1' }] }),
    };
    const repository = { createQueryBuilder: () => builder };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditIngestService,
        { provide: getRepositoryToken(AuditEvent), useValue: repository },
      ],
    }).compile();

    service = module.get(AuditIngestService);
  });

  it('maps the envelope into an insert with conflict-ignore', async () => {
    await service.record(event);

    expect(builder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: event.eventId,
        eventType: WORK_ORDER_EVENTS.CREATED,
        workOrderId: event.data.workOrderId,
        correlationId: 'req-1',
      }),
    );
    expect(builder.orIgnore).toHaveBeenCalled();
  });

  it('treats a duplicate (no identifiers returned) as success', async () => {
    builder.execute.mockResolvedValue({ identifiers: [] });

    await expect(service.record(event)).resolves.toBeUndefined();
  });
});
