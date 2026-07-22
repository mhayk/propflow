import { DataSource } from 'typeorm';
import dataSource from './data-source';

describe('properties data source', () => {
  it('exposes a postgres DataSource for the TypeORM CLI', () => {
    expect(dataSource).toBeInstanceOf(DataSource);
    expect(dataSource.options.type).toBe('postgres');
    expect(dataSource.options.synchronize).toBe(false);
  });
});
