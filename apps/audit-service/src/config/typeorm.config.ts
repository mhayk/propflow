import { DataSourceOptions } from 'typeorm';
import { AuditEvent } from '../audit/audit-event.entity';
import { CreateAuditEventsTable1753058000000 } from '../database/migrations/1753058000000-create-audit-events-table';
import { AddActorId1753316000000 } from '../database/migrations/1753316000000-add-actor-id';

/**
 * Single source of truth for database options, shared by the Nest application
 * and the TypeORM CLI data source so they can never drift apart.
 */
export function buildDataSourceOptions(
  env: Record<string, string | undefined>,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.AUDIT_DB_HOST ?? 'localhost',
    port: parseInt(env.AUDIT_DB_PORT ?? '5432', 10),
    username: env.AUDIT_DB_USER ?? 'propflow',
    password: env.AUDIT_DB_PASSWORD ?? 'propflow',
    database: env.AUDIT_DB_NAME ?? 'audit',
    // Explicit lists (no glob paths): globs break under webpack bundling and jest.
    entities: [AuditEvent],
    migrations: [CreateAuditEventsTable1753058000000, AddActorId1753316000000],
    // Schema changes only go through reviewed migrations, never auto-sync.
    synchronize: false,
    migrationsRun: true,
  };
}
