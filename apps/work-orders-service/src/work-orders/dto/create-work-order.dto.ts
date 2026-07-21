import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { WorkOrderPriority } from '../work-order.enums';

export class CreateWorkOrderDto {
  @IsString()
  @Length(3, 200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsUUID()
  propertyId!: string;

  @IsOptional()
  @IsEnum(WorkOrderPriority)
  priority?: WorkOrderPriority;
}
