import type { QueryRunner } from 'typeorm';
import { CreatePropertiesTable1753057000000 } from './1753057000000-create-properties-table';

describe('CreatePropertiesTable1753057000000', () => {
  let query: jest.Mock;
  let queryRunner: QueryRunner;

  beforeEach(() => {
    query = jest.fn().mockResolvedValue(undefined);
    queryRunner = { query } as unknown as QueryRunner;
  });

  const executedSql = (): string[] =>
    (query.mock.calls as unknown as [string][]).map(([sql]) => sql);

  it('creates the properties table and the city index', async () => {
    await new CreatePropertiesTable1753057000000().up(queryRunner);

    expect(query).toHaveBeenCalledTimes(2);
    expect(executedSql()[0]).toContain('CREATE TABLE properties');
    expect(executedSql()[1]).toContain('CREATE INDEX idx_properties_city');
  });

  it('drops the properties table on revert', async () => {
    await new CreatePropertiesTable1753057000000().down(queryRunner);

    expect(query).toHaveBeenCalledTimes(1);
    expect(executedSql()[0]).toContain('DROP TABLE properties');
  });
});
