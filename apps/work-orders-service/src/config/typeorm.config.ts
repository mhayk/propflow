import { DataSourceOptions } from 'typeorm';
import { CreateWorkOrdersTable1753056000000 } from '../database/migrations/1753056000000-create-work-orders-table';
import { AddTriageColumns1753142000000 } from '../database/migrations/1753142000000-add-triage-columns';
import { CreateOutboxTable1753228000000 } from '../database/migrations/1753228000000-create-outbox-table';
import { OutboxEvent } from '../messaging/outbox-event.entity';
import { WorkOrder } from '../work-orders/work-order.entity';

/**
 * Single source of truth for database options, shared by the Nest application
 * and the TypeORM CLI data source so they can never drift apart.
 */
export function buildDataSourceOptions(
  env: Record<string, string | undefined>,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.WORK_ORDERS_DB_HOST ?? 'localhost',
    port: parseInt(env.WORK_ORDERS_DB_PORT ?? '5432', 10),
    username: env.WORK_ORDERS_DB_USER ?? 'propflow',
    password: env.WORK_ORDERS_DB_PASSWORD ?? 'propflow',
    database: env.WORK_ORDERS_DB_NAME ?? 'work_orders',
    // Explicit lists (no glob paths): globs break under webpack bundling and jest.
    entities: [WorkOrder, OutboxEvent],
    migrations: [
      CreateWorkOrdersTable1753056000000,
      AddTriageColumns1753142000000,
      CreateOutboxTable1753228000000,
    ],
    // Schema changes only go through reviewed migrations, never auto-sync.
    synchronize: false,
    migrationsRun: true,
  };
}
