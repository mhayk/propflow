import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { buildLoggerOptions, MetricsModule } from '@app/observability';
import { AuditModule } from './audit/audit.module';
import { buildDataSourceOptions } from './config/typeorm.config';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot(buildLoggerOptions('audit-service')),
    MetricsModule.forRoot('audit-service'),
    HealthModule,
    // ConfigModule.forRoot() has already loaded .env into process.env at this point.
    TypeOrmModule.forRootAsync({
      useFactory: () => buildDataSourceOptions(process.env),
    }),
    AuditModule,
  ],
})
export class AppModule {}
