import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';
const ASSIGNEE_ID = '22222222-2222-4222-8222-222222222222';

describe('WorkOrders (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  const createWorkOrder = async (
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; status: string }> => {
    const response = await request(app.getHttpServer())
      .post('/work-orders')
      .send({
        title: 'Leaking tap in kitchen',
        description: 'Constant drip under the sink',
        propertyId: PROPERTY_ID,
        ...overrides,
      })
      .expect(201);
    return response.body as { id: string; status: string };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE work_orders');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /work-orders', () => {
    it('creates a work order with defaults applied by the database', async () => {
      const created = await createWorkOrder();

      expect(created).toMatchObject({
        title: 'Leaking tap in kitchen',
        propertyId: PROPERTY_ID,
        priority: 'medium',
        status: 'open',
        assigneeId: null,
      });
      expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('rejects an invalid payload with field-level messages', async () => {
      const response = await request(app.getHttpServer())
        .post('/work-orders')
        .send({ title: 'ab', propertyId: 'not-a-uuid', extra: 'field' })
        .expect(400);

      const body = response.body as { message: string[] };
      expect(body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('title'),
          expect.stringContaining('propertyId'),
          expect.stringContaining('extra'),
        ]),
      );
    });
  });

  describe('GET /work-orders', () => {
    it('filters by status and paginates', async () => {
      await createWorkOrder({ title: 'Order A' });
      await createWorkOrder({ title: 'Order B' });
      const { id } = await createWorkOrder({ title: 'Order C' });
      await request(app.getHttpServer())
        .patch(`/work-orders/${id}/assign`)
        .send({ assigneeId: ASSIGNEE_ID })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/work-orders')
        .query({ status: 'open', page: 1, limit: 1 })
        .expect(200);

      const body = response.body as {
        data: unknown[];
        meta: { total: number };
      };
      expect(body.data).toHaveLength(1);
      expect(body.meta.total).toBe(2);
    });

    it('rejects an unknown status filter', async () => {
      await request(app.getHttpServer())
        .get('/work-orders')
        .query({ status: 'bogus' })
        .expect(400);
    });
  });

  describe('GET /work-orders/:id', () => {
    it('returns 404 for a non-existent id', async () => {
      await request(app.getHttpServer())
        .get('/work-orders/33333333-3333-4333-8333-333333333333')
        .expect(404);
    });

    it('returns 400 for a malformed id', async () => {
      await request(app.getHttpServer())
        .get('/work-orders/not-a-uuid')
        .expect(400);
    });
  });

  describe('lifecycle', () => {
    it('walks the happy path: open -> assigned -> in_progress -> completed', async () => {
      const { id } = await createWorkOrder();

      const assigned = await request(app.getHttpServer())
        .patch(`/work-orders/${id}/assign`)
        .send({ assigneeId: ASSIGNEE_ID })
        .expect(200);
      expect(assigned.body).toMatchObject({
        status: 'assigned',
        assigneeId: ASSIGNEE_ID,
      });

      await request(app.getHttpServer())
        .patch(`/work-orders/${id}/status`)
        .send({ status: 'in_progress' })
        .expect(200);

      const completed = await request(app.getHttpServer())
        .patch(`/work-orders/${id}/status`)
        .send({ status: 'completed' })
        .expect(200);
      expect(completed.body).toMatchObject({ status: 'completed' });
    });

    it('rejects an invalid transition with 409', async () => {
      const { id } = await createWorkOrder();

      await request(app.getHttpServer())
        .patch(`/work-orders/${id}/status`)
        .send({ status: 'completed' })
        .expect(409);
    });

    it('rejects assigning a completed work order with 409', async () => {
      const { id } = await createWorkOrder();
      await request(app.getHttpServer())
        .patch(`/work-orders/${id}/assign`)
        .send({ assigneeId: ASSIGNEE_ID });
      await request(app.getHttpServer())
        .patch(`/work-orders/${id}/status`)
        .send({ status: 'in_progress' });
      await request(app.getHttpServer())
        .patch(`/work-orders/${id}/status`)
        .send({ status: 'completed' });

      await request(app.getHttpServer())
        .patch(`/work-orders/${id}/assign`)
        .send({ assigneeId: ASSIGNEE_ID })
        .expect(409);
    });
  });
});
