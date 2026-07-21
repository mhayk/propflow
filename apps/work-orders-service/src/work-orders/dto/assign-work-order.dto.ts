import { IsUUID } from 'class-validator';

export class AssignWorkOrderDto {
  @IsUUID()
  assigneeId!: string;
}
