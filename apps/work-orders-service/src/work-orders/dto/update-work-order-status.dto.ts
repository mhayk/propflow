import { IsEnum } from 'class-validator';
import { WorkOrderStatus } from '../work-order.enums';

export class UpdateWorkOrderStatusDto {
  @IsEnum(WorkOrderStatus)
  status!: WorkOrderStatus;
}
