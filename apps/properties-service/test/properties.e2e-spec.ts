import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';

describe('Properties (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  const validPayload = {
    name: 'Riverside House',
    addressLine1: '12 Thames Road',
    city: 'London',
    postcode: 'SE1 7TP',
    managerEmail: 'manager@example.com',
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
    await dataSource.query('TRUNCATE TABLE properties');
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('creates and fetches a property', async () => {
    const created = await request(app.getHttpServer())
      .post('/properties')
      .send(validPayload)
      .expect(201);

    const body = created.body as { id: string };
    await request(app.getHttpServer())
      .get(`/properties/${body.id}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject(validPayload);
      });
  });

  it('rejects an invalid email with 400', async () => {
    await request(app.getHttpServer())
      .post('/properties')
      .send({ ...validPayload, managerEmail: 'not-an-email' })
      .expect(400);
  });

  it('filters the listing by city', async () => {
    await request(app.getHttpServer()).post('/properties').send(validPayload);
    await request(app.getHttpServer())
      .post('/properties')
      .send({ ...validPayload, name: 'North Flat', city: 'Manchester' });

    const response = await request(app.getHttpServer())
      .get('/properties')
      .query({ city: 'Manchester' })
      .expect(200);

    const body = response.body as { data: { city: string }[] };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].city).toBe('Manchester');
  });

  it('returns 404 for an unknown property', async () => {
    await request(app.getHttpServer())
      .get('/properties/33333333-3333-4333-8333-333333333333')
      .expect(404);
  });
});
