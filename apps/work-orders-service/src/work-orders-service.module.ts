import { Module } from '@nestjs/common';
import { WorkOrdersServiceController } from './work-orders-service.controller';
import { WorkOrdersServiceService } from './work-orders-service.service';

@Module({
  imports: [],
  controllers: [WorkOrdersServiceController],
  providers: [WorkOrdersServiceService],
})
export class WorkOrdersServiceModule {}
