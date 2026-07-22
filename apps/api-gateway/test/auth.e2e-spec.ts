import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';

/**
 * Authentication and authorization at the edge. No downstream service is
 * running in this suite on purpose: 401/403 must be decided by the gateway
 * alone, before any proxying happens.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  const login = (email: string, password: string) =>
    request(app.getHttpServer()).post('/api/auth/login').send({
      email,
      password,
    });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('issues a token for valid demo credentials', async () => {
    const response = await login('manager@propflow.dev', 'propflow').expect(
      200,
    );

    const body = response.body as { accessToken: string; role: string };
    expect(body.role).toBe('manager');
    expect(body.accessToken.split('.')).toHaveLength(3); // header.payload.sig
  });

  it('rejects bad credentials with 401', async () => {
    await login('manager@propflow.dev', 'wrong').expect(401);
    await login('ghost@propflow.dev', 'propflow').expect(401);
  });

  it('requires a token on protected routes (401)', async () => {
    await request(app.getHttpServer()).get('/api/work-orders').expect(401);
  });

  it('rejects a forged token (401)', async () => {
    await request(app.getHttpServer())
      .get('/api/work-orders')
      .set('Authorization', 'Bearer not.a.jwt')
      .expect(401);
  });

  it('refuses a role outside the route policy (403, before any proxying)', async () => {
    const tenant = (
      (await login('tenant@propflow.dev', 'propflow').expect(200)).body as {
        accessToken: string;
      }
    ).accessToken;

    await request(app.getHttpServer())
      .patch('/api/work-orders/11111111-1111-4111-8111-111111111111/assign')
      .set('Authorization', `Bearer ${tenant}`)
      .send({ assigneeId: '22222222-2222-4222-8222-222222222222' })
      .expect(403);
  });

  it('keeps the platform endpoints public', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);
    await request(app.getHttpServer()).get('/api/metrics').expect(200);
  });

  it('serves the OpenAPI docs without a token', async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(200);
    await request(app.getHttpServer()).get('/api/docs-json').expect(200);
  });
});
