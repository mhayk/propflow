import { CreatePropertiesTable1753057000000 } from '../database/migrations/1753057000000-create-properties-table';
import { Property } from '../properties/property.entity';
import { buildDataSourceOptions } from './typeorm.config';

describe('buildDataSourceOptions', () => {
  it('falls back to local development defaults when the env is empty', () => {
    expect(buildDataSourceOptions({})).toEqual({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'propflow',
      password: 'propflow',
      database: 'properties',
      entities: [Property],
      migrations: [CreatePropertiesTable1753057000000],
      synchronize: false,
      migrationsRun: true,
    });
  });

  it('reads every connection setting from the environment', () => {
    const options = buildDataSourceOptions({
      PROPERTIES_DB_HOST: 'db.internal',
      PROPERTIES_DB_PORT: '15432',
      PROPERTIES_DB_USER: 'svc-properties',
      PROPERTIES_DB_PASSWORD: 's3cret',
      PROPERTIES_DB_NAME: 'properties_prod',
    });

    expect(options).toMatchObject({
      host: 'db.internal',
      port: 15432,
      username: 'svc-properties',
      password: 's3cret',
      database: 'properties_prod',
      synchronize: false,
      migrationsRun: true,
    });
  });
});
