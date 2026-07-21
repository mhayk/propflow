import { Module } from '@nestjs/common';
import { PropertiesClient } from './clients/properties.client';
import { WorkOrdersClient } from './clients/work-orders.client';
import { PropertiesController } from './controllers/properties.controller';
import { WorkOrdersController } from './controllers/work-orders.controller';

@Module({
  controllers: [WorkOrdersController, PropertiesController],
  providers: [WorkOrdersClient, PropertiesClient],
})
export class GatewayModule {}
