import { CreateWorkOrdersTable1753056000000 } from '../database/migrations/1753056000000-create-work-orders-table';
import { AddTriageColumns1753142000000 } from '../database/migrations/1753142000000-add-triage-columns';
import { CreateOutboxTable1753228000000 } from '../database/migrations/1753228000000-create-outbox-table';
import { OutboxEvent } from '../messaging/outbox-event.entity';
import { WorkOrder } from '../work-orders/work-order.entity';
import { buildDataSourceOptions } from './typeorm.config';

describe('buildDataSourceOptions', () => {
  it('falls back to local development defaults when the env is empty', () => {
    const options = buildDataSourceOptions({});

    expect(options).toMatchObject({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'propflow',
      password: 'propflow',
      database: 'work_orders',
    });
  });

  it('uses every WORK_ORDERS_DB_* variable when set', () => {
    const options = buildDataSourceOptions({
      WORK_ORDERS_DB_HOST: 'db.internal',
      WORK_ORDERS_DB_PORT: '15432',
      WORK_ORDERS_DB_USER: 'svc_work_orders',
      WORK_ORDERS_DB_PASSWORD: 's3cret',
      WORK_ORDERS_DB_NAME: 'work_orders_prod',
    });

    expect(options).toMatchObject({
      host: 'db.internal',
      port: 15432,
      username: 'svc_work_orders',
      password: 's3cret',
      database: 'work_orders_prod',
    });
  });

  it('registers entities and migrations explicitly and never auto-syncs', () => {
    const options = buildDataSourceOptions({});

    expect(options).toMatchObject({
      entities: [WorkOrder, OutboxEvent],
      migrations: [
        CreateWorkOrdersTable1753056000000,
        AddTriageColumns1753142000000,
        CreateOutboxTable1753228000000,
      ],
      synchronize: false,
      migrationsRun: true,
    });
  });
});
