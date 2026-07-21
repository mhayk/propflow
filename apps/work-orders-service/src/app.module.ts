import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { buildLoggerOptions, MetricsModule } from '@app/observability';
import { HealthModule } from './health/health.module';
import { buildDataSourceOptions } from './config/typeorm.config';
import { WorkOrdersModule } from './work-orders/work-orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot(buildLoggerOptions('work-orders-service')),
    MetricsModule.forRoot('work-orders-service'),
    HealthModule,
    // ConfigModule.forRoot() has already loaded .env into process.env at this point.
    TypeOrmModule.forRootAsync({
      useFactory: () => buildDataSourceOptions(process.env),
    }),
    WorkOrdersModule,
  ],
})
export class AppModule {}
