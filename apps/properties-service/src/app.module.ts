import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { buildLoggerOptions } from '@app/observability';
import { AppController } from './app.controller';
import { buildDataSourceOptions } from './config/typeorm.config';
import { PropertiesModule } from './properties/properties.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot(buildLoggerOptions('properties-service')),
    // ConfigModule.forRoot() has already loaded .env into process.env at this point.
    TypeOrmModule.forRootAsync({
      useFactory: () => buildDataSourceOptions(process.env),
    }),
    PropertiesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
