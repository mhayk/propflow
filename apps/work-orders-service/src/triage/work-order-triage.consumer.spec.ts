import { Test, TestingModule } from '@nestjs/testing';
import { WORK_ORDER_EVENTS, WorkOrderEvent } from '@app/contracts';
import { TriageClassifier } from './triage-classifier';
import { TriageService } from './triage.service';
import { WorkOrderTriageConsumer } from './work-order-triage.consumer';

describe('WorkOrderTriageConsumer', () => {
  let consumer: WorkOrderTriageConsumer;
  let classifier: { classify: jest.Mock };
  let triage: { apply: jest.Mock };

  const event: WorkOrderEvent = {
    eventId: '44444444-4444-4444-8444-444444444444',
    type: WORK_ORDER_EVENTS.CREATED,
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
  };

  beforeEach(async () => {
    classifier = { classify: jest.fn() };
    triage = { apply: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkOrderTriageConsumer,
        { provide: TriageClassifier, useValue: classifier },
        { provide: TriageService, useValue: triage },
      ],
    }).compile();

    consumer = module.get(WorkOrderTriageConsumer);
  });

  it('feeds the event through the classifier and applies the result', async () => {
    classifier.classify.mockResolvedValue({
      category: 'plumbing',
      urgency: 'high',
      reasoning: 'Active leak.',
    });

    await consumer.onWorkOrderCreated(event);

    expect(classifier.classify).toHaveBeenCalledWith({
      title: event.data.title,
      description: event.data.description,
      priority: event.data.priority,
    });
    expect(triage.apply).toHaveBeenCalledWith(
      event.data.workOrderId,
      expect.objectContaining({ category: 'plumbing' }),
    );
  });

  it('does nothing when no classification is available', async () => {
    classifier.classify.mockResolvedValue(null);

    await consumer.onWorkOrderCreated(event);

    expect(triage.apply).not.toHaveBeenCalled();
  });
});
