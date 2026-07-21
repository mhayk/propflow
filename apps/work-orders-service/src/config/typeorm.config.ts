import { DataSourceOptions } from 'typeorm';

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
    entities: [],
    migrations: [],
    // Schema changes only go through reviewed migrations, never auto-sync.
    synchronize: false,
    migrationsRun: true,
  };
}
