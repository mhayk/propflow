import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { buildDataSourceOptions } from './config/typeorm.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // ConfigModule.forRoot() has already loaded .env into process.env at this point.
    TypeOrmModule.forRootAsync({
      useFactory: () => buildDataSourceOptions(process.env),
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
