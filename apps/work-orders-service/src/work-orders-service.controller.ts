import { Controller, Get } from '@nestjs/common';
import { WorkOrdersServiceService } from './work-orders-service.service';

@Controller()
export class WorkOrdersServiceController {
  constructor(
    private readonly workOrdersServiceService: WorkOrdersServiceService,
  ) {}

  @Get()
  getHello(): string {
    return this.workOrdersServiceService.getHello();
  }
}
