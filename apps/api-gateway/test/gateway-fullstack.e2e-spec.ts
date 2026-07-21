import { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
// Cross-app imports are forbidden in src/ (services are deployment-independent);
// this system-level suite is the deliberate exception - it IS the composition.
import { AppModule as PropertiesAppModule } from '../../properties-service/src/app.module';
import { configureApp as configureProperties } from '../../properties-service/src/app.setup';
import { AppModule as WorkOrdersAppModule } from '../../work-orders-service/src/app.module';
import { configureApp as configureWorkOrders } from '../../work-orders-service/src/app.setup';
import { AppModule as GatewayAppModule } from '../src/app.module';
import { configureApp as configureGateway } from '../src/app.setup';

const bootDownstream = async (
  module: unknown,
  configure: (app: INestApplication) => void,
  urlEnvVar: string,
): Promise<INestApplication> => {
  const fixture = await Test.createTestingModule({
    imports: [module as never],
  }).compile();
  const app = fixture.createNestApplication();
  configure(app);
  await app.listen(0, '127.0.0.1');
  const server = app.getHttpServer() as import('node:http').Server;
  const { port } = server.address() as AddressInfo;
  process.env[urlEnvVar] = `http://127.0.0.1:${port}`;
  return app;
};

describe('Gateway full-stack (e2e)', () => {
  let workOrdersApp: INestApplication;
  let propertiesApp: INestApplication;
  let gateway: INestApplication<App>;

  beforeAll(async () => {
    workOrdersApp = await bootDownstream(
      WorkOrdersAppModule,
      configureWorkOrders,
      'WORK_ORDERS_URL',
    );
    propertiesApp = await bootDownstream(
      PropertiesAppModule,
      configureProperties,
      'PROPERTIES_URL',
    );

    await workOrdersApp.get(DataSource).query('TRUNCATE TABLE work_orders');
    await propertiesApp.get(DataSource).query('TRUNCATE TABLE properties');

    // The gateway boots last: its clients capture the downstream URLs above.
    const fixture = await Test.createTestingModule({
      imports: [GatewayAppModule],
    }).compile();
    gateway = fixture.createNestApplication();
    configureGateway(gateway);
    await gateway.init();
  }, 60_000);

  afterAll(async () => {
    await gateway?.close();
    await propertiesApp?.close();
    await workOrdersApp?.close();
  });

  let propertyId: string;
  let workOrderId: string;

  it('creates a property through the gateway', async () => {
    const response = await request(gateway.getHttpServer())
      .post('/api/properties')
      .send({
        name: 'Riverside House',
        addressLine1: '12 Thames Road',
        city: 'London',
        postcode: 'SE1 7TP',
        managerEmail: 'manager@example.com',
      })
      .expect(201);

    propertyId = (response.body as { id: string }).id;
  });

  it('creates a work order through the gateway', async () => {
    const response = await request(gateway.getHttpServer())
      .post('/api/work-orders')
      .send({
        title: 'Broken boiler',
        description: 'No hot water since Monday',
        propertyId,
        priority: 'urgent',
      })
      .expect(201);

    workOrderId = (response.body as { id: string }).id;
  });

  it('passes downstream validation errors through untouched', async () => {
    const response = await request(gateway.getHttpServer())
      .post('/api/work-orders')
      .send({ title: 'x' })
      .expect(400);

    expect((response.body as { message: string[] }).message).toEqual(
      expect.arrayContaining([expect.stringContaining('title')]),
    );
  });

  it('passes a domain conflict (409) through untouched', async () => {
    await request(gateway.getHttpServer())
      .patch(`/api/work-orders/${workOrderId}/status`)
      .send({ status: 'completed' })
      .expect(409);
  });

  it('composes the property summary from both services', async () => {
    const response = await request(gateway.getHttpServer())
      .get(`/api/properties/${propertyId}/summary`)
      .expect(200);

    const body = response.body as {
      property: { id: string };
      workOrders: { id: string }[];
      workOrdersAvailable: boolean;
    };
    expect(body.property.id).toBe(propertyId);
    expect(body.workOrdersAvailable).toBe(true);
    expect(body.workOrders.map((wo) => wo.id)).toContain(workOrderId);
  });

  it('degrades the summary when the work-orders service goes down', async () => {
    await workOrdersApp.close();

    const response = await request(gateway.getHttpServer())
      .get(`/api/properties/${propertyId}/summary`)
      .expect(200);

    const body = response.body as {
      property: { id: string };
      workOrders: null;
      workOrdersAvailable: boolean;
    };
    expect(body.property.id).toBe(propertyId);
    expect(body.workOrders).toBeNull();
    expect(body.workOrdersAvailable).toBe(false);
  });
});
