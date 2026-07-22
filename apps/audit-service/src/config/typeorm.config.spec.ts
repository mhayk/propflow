import { AuditEvent } from '../audit/audit-event.entity';
import { buildDataSourceOptions } from './typeorm.config';

describe('buildDataSourceOptions', () => {
  it('falls back to local defaults when the environment is empty', () => {
    const options = buildDataSourceOptions({});

    expect(options).toMatchObject({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'propflow',
      password: 'propflow',
      database: 'audit',
      synchronize: false,
      migrationsRun: true,
    });
    expect(options.entities).toEqual([AuditEvent]);
  });

  it('reads every connection setting from the environment', () => {
    const options = buildDataSourceOptions({
      AUDIT_DB_HOST: 'audit-db',
      AUDIT_DB_PORT: '6543',
      AUDIT_DB_USER: 'auditor',
      AUDIT_DB_PASSWORD: 'secret',
      AUDIT_DB_NAME: 'audit_test',
    });

    expect(options).toMatchObject({
      host: 'audit-db',
      port: 6543,
      username: 'auditor',
      password: 'secret',
      database: 'audit_test',
    });
  });
});
