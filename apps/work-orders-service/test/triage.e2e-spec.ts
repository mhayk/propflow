import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { WorkOrderTriage } from '@app/contracts';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import {
  TriageClassifier,
  TriageInput,
} from './../src/triage/triage-classifier';

/**
 * Deterministic stand-in for the LLM, swapped in at the same seam production
 * uses (the TriageClassifier provider) — the e2e exercises the full
 * event-driven loop (publish -> consume -> classify -> persist -> re-publish)
 * without a network call or a nondeterministic model in the way.
 */
class StubClassifier extends TriageClassifier {
  readonly seen: TriageInput[] = [];

  classify(input: TriageInput): Promise<WorkOrderTriage | null> {
    this.seen.push(input);
    return Promise.resolve({
      category: 'plumbing',
      urgency: 'emergency',
      reasoning: 'Water is actively flooding the unit.',
    });
  }
}

const until = async (
  predicate: () => Promise<boolean>,
  timeoutMs = 15_000,
): Promise<void> => {
  const startedAt = Date.now();
  while (!(await predicate())) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('condition not met in time');
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
};

interface WorkOrderResponse {
  id: string;
  triageCategory: string | null;
  triageUrgency: string | null;
  triageReasoning: string | null;
  triagedAt: string | null;
}

describe('Work order triage (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const classifier = new StubClassifier();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TriageClassifier)
      .useValue(classifier)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
  }, 30_000);

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE work_orders');
  });

  afterAll(async () => {
    await app.close();
  });

  it('classifies a new work order through the event loop and persists the result', async () => {
    const created = await request(app.getHttpServer())
      .post('/work-orders')
      .send({
        title: 'Burst pipe in bathroom',
        description: 'Water is pouring out from under the sink',
        propertyId: '11111111-1111-4111-8111-111111111111',
        priority: 'high',
      })
      .expect(201);
    const { id } = created.body as WorkOrderResponse;

    // The HTTP response returns before triage: classification is async by
    // design, so the fresh order has no triage yet.
    expect((created.body as WorkOrderResponse).triagedAt).toBeNull();

    await until(async () => {
      const response = await request(app.getHttpServer())
        .get(`/work-orders/${id}`)
        .expect(200);
      return (response.body as WorkOrderResponse).triagedAt !== null;
    });

    const triaged = await request(app.getHttpServer())
      .get(`/work-orders/${id}`)
      .expect(200);
    const body = triaged.body as WorkOrderResponse;
    expect(body.triageCategory).toBe('plumbing');
    expect(body.triageUrgency).toBe('emergency');
    expect(body.triageReasoning).toContain('flooding');

    // The classifier saw the full request context, not just the title.
    expect(classifier.seen.at(-1)).toEqual({
      title: 'Burst pipe in bathroom',
      description: 'Water is pouring out from under the sink',
      priority: 'high',
    });
  });
});
