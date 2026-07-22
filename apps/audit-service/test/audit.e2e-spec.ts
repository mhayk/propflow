import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Kafka, Producer } from 'kafkajs';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { TOPICS, WORK_ORDER_EVENTS, WorkOrderEvent } from '@app/contracts';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { AuditEvent } from './../src/audit/audit-event.entity';

const until = async (
  predicate: () => Promise<boolean>,
  timeoutMs = 20_000,
): Promise<void> => {
  const startedAt = Date.now();
  while (!(await predicate())) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('condition not met in time');
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
};

interface FeedPage {
  data: { eventType: string }[];
  nextCursor: string | null;
}

describe('Audit stream (e2e)', () => {
  let app: INestApplication<App>;
  let producer: Producer;
  let repository: Repository<AuditEvent>;

  const buildEvent = (
    type: WorkOrderEvent['type'],
    workOrderId: string,
  ): WorkOrderEvent => ({
    eventId: randomUUID(),
    type,
    occurredAt: new Date().toISOString(),
    correlationId: `e2e-${randomUUID()}`,
    data: {
      workOrderId,
      propertyId: randomUUID(),
      title: `e2e ${randomUUID()}`,
      description: 'raised by the audit e2e suite',
      priority: 'high',
      status: 'open',
      assigneeId: null,
    },
  });

  const produce = (event: WorkOrderEvent): Promise<unknown> =>
    producer.send({
      topic: TOPICS.WORK_ORDER_EVENTS,
      messages: [{ key: event.data.workOrderId, value: JSON.stringify(event) }],
    });

  // No "wait for the consumer to bind" dance here, unlike the RabbitMQ e2e:
  // Kafka is a log, so events produced before the consumer group joins are
  // simply read once it does. The `until` polls below only wait for ingestion.
  beforeAll(async () => {
    const kafka = new Kafka({
      clientId: 'audit-e2e',
      brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
    });
    producer = kafka.producer({ allowAutoTopicCreation: true });
    await producer.connect();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    repository = app.get(getRepositoryToken(AuditEvent));
  }, 60_000);

  afterAll(async () => {
    await producer.disconnect();
    await app.close();
  });

  it('projects a produced event into the audit table exactly once, even when delivered twice', async () => {
    const event = buildEvent(WORK_ORDER_EVENTS.CREATED, randomUUID());

    // Same event twice simulates the duplicate delivery inherent to
    // at-least-once; a sentinel event afterwards proves both copies have been
    // processed (single-partition topic, so processing is in order).
    await produce(event);
    await produce(event);
    const sentinel = buildEvent(WORK_ORDER_EVENTS.CREATED, randomUUID());
    await produce(sentinel);

    await until(
      async () => (await repository.countBy({ eventId: sentinel.eventId })) > 0,
    );

    const rows = await repository.findBy({ eventId: event.eventId });
    expect(rows).toHaveLength(1);
    expect(rows[0].eventType).toBe(WORK_ORDER_EVENTS.CREATED);
    expect(rows[0].workOrderId).toBe(event.data.workOrderId);
    expect(rows[0].payload).toMatchObject({ title: event.data.title });
  });

  it('serves the activity feed newest-first with a working cursor', async () => {
    const workOrderId = randomUUID();
    const events = [
      buildEvent(WORK_ORDER_EVENTS.CREATED, workOrderId),
      buildEvent(WORK_ORDER_EVENTS.ASSIGNED, workOrderId),
      buildEvent(WORK_ORDER_EVENTS.COMPLETED, workOrderId),
    ];
    for (const event of events) {
      await produce(event);
    }

    await until(async () => (await repository.countBy({ workOrderId })) === 3);

    const firstResponse = await request(app.getHttpServer())
      .get('/activity')
      .query({ workOrderId, limit: 2 })
      .expect(200);
    const firstPage = firstResponse.body as FeedPage;

    expect(firstPage.data).toHaveLength(2);
    expect(firstPage.data.map((e) => e.eventType)).toEqual([
      WORK_ORDER_EVENTS.COMPLETED,
      WORK_ORDER_EVENTS.ASSIGNED,
    ]);
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    const secondResponse = await request(app.getHttpServer())
      .get('/activity')
      .query({ workOrderId, limit: 2, cursor: firstPage.nextCursor ?? '' })
      .expect(200);
    const secondPage = secondResponse.body as FeedPage;

    expect(secondPage.data).toHaveLength(1);
    expect(secondPage.data[0].eventType).toBe(WORK_ORDER_EVENTS.CREATED);
    expect(secondPage.nextCursor).toBeNull();
  });

  it('rejects malformed feed queries', async () => {
    await request(app.getHttpServer())
      .get('/activity')
      .query({ limit: 0 })
      .expect(400);
    await request(app.getHttpServer())
      .get('/activity')
      .query({ cursor: 'not-a-number' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/activity')
      .query({ workOrderId: 'not-a-uuid' })
      .expect(400);
  });
});
