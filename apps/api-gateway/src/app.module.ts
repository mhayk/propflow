import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), GatewayModule],
  controllers: [AppController],
})
export class AppModule {}
