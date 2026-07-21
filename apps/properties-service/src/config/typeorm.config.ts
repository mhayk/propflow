import { DataSourceOptions } from 'typeorm';
import { CreatePropertiesTable1753057000000 } from '../database/migrations/1753057000000-create-properties-table';
import { Property } from '../properties/property.entity';

/**
 * Single source of truth for database options, shared by the Nest application
 * and the TypeORM CLI data source so they can never drift apart.
 */
export function buildDataSourceOptions(
  env: Record<string, string | undefined>,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.PROPERTIES_DB_HOST ?? 'localhost',
    port: parseInt(env.PROPERTIES_DB_PORT ?? '5432', 10),
    username: env.PROPERTIES_DB_USER ?? 'propflow',
    password: env.PROPERTIES_DB_PASSWORD ?? 'propflow',
    database: env.PROPERTIES_DB_NAME ?? 'properties',
    // Explicit lists (no glob paths): globs break under webpack bundling and jest.
    entities: [Property],
    migrations: [CreatePropertiesTable1753057000000],
    // Schema changes only go through reviewed migrations, never auto-sync.
    synchronize: false,
    migrationsRun: true,
  };
}
