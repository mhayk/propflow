import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../config/typeorm.config';

// Entry point for the TypeORM CLI (migration:run / migration:revert).
export default new DataSource(buildDataSourceOptions(process.env));
