import { Module } from '@nestjs/common';
import { PropertiesClient } from './clients/properties.client';
import { WorkOrdersClient } from './clients/work-orders.client';
import { PropertiesController } from './controllers/properties.controller';
import { WorkOrdersController } from './controllers/work-orders.controller';
import { PropertySummaryController } from './summary/property-summary.controller';
import { PropertySummaryService } from './summary/property-summary.service';

@Module({
  // Summary controller first: its static ':id/summary' segment must be
  // registered before the generic ':id' route.
  controllers: [
    PropertySummaryController,
    WorkOrdersController,
    PropertiesController,
  ],
  providers: [WorkOrdersClient, PropertiesClient, PropertySummaryService],
})
export class GatewayModule {}
