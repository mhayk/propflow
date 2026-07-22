import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Downstream response shapes as the gateway consumes them — and, decorated,
 * the OpenAPI contract it publishes at /api/docs. Kept minimal and local:
 * the gateway is a client of the services' public APIs, not of their
 * internals. (Generated OpenAPI clients would replace these at scale.)
 */
export class WorkOrderDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Leaking tap in kitchen' })
  title!: string;

  @ApiProperty({ example: 'Constant drip under the sink' })
  description!: string;

  @ApiProperty({ format: 'uuid' })
  propertyId!: string;

  @ApiProperty({ enum: ['low', 'medium', 'high', 'urgent'] })
  priority!: string;

  @ApiProperty({
    enum: ['open', 'assigned', 'in_progress', 'completed', 'cancelled'],
  })
  status!: string;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  assigneeId!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    enum: [
      'plumbing',
      'electrical',
      'hvac',
      'appliance',
      'structural',
      'pest_control',
      'other',
    ],
    description: 'AI triage category — null until (and unless) triage runs',
  })
  triageCategory!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    enum: ['emergency', 'high', 'medium', 'low'],
  })
  triageUrgency!: string | null;

  @ApiProperty({ nullable: true, type: String })
  triageReasoning!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  triagedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class PropertyDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Riverside House' })
  name!: string;

  @ApiProperty({ example: '12 Thames Road' })
  addressLine1!: string;

  @ApiProperty({ example: 'London' })
  city!: string;

  @ApiProperty({ example: 'SE1 7TP' })
  postcode!: string;

  @ApiProperty({ example: 'manager@propflow.dev' })
  managerEmail!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class ActivityEventDto {
  @ApiProperty({ description: 'Feed cursor — monotonic, opaque to clients' })
  id!: string;

  @ApiProperty({ example: 'work-order.created' })
  eventType!: string;

  @ApiProperty({ format: 'uuid' })
  workOrderId!: string;

  @ApiProperty({ format: 'uuid' })
  propertyId!: string;

  @ApiProperty({ nullable: true, type: String })
  correlationId!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Who performed the action — null for system-initiated events',
  })
  actorId!: string | null;

  @ApiProperty({ format: 'date-time' })
  occurredAt!: string;

  @ApiProperty({ type: Object })
  payload!: Record<string, unknown>;
}

export class PageMeta {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
}

export class WorkOrderPage implements Paginated<WorkOrderDto> {
  @ApiProperty({ type: [WorkOrderDto] })
  data!: WorkOrderDto[];

  @ApiProperty()
  meta!: PageMeta;
}

export class PropertyPage implements Paginated<PropertyDto> {
  @ApiProperty({ type: [PropertyDto] })
  data!: PropertyDto[];

  @ApiProperty()
  meta!: PageMeta;
}

export class ActivityPage implements CursorPage<ActivityEventDto> {
  @ApiProperty({ type: [ActivityEventDto] })
  data!: ActivityEventDto[];

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Pass back as ?cursor= for the next page; null at the end',
  })
  nextCursor!: string | null;
}

export class PropertySummaryDto {
  @ApiProperty()
  property!: PropertyDto;

  @ApiProperty({
    type: [WorkOrderDto],
    nullable: true,
    description: 'null when the work-orders service was unreachable',
  })
  workOrders!: WorkOrderDto[] | null;

  @ApiProperty()
  workOrdersAvailable!: boolean;
}

// Request bodies. Validation lives with the owning service (the gateway
// passes bodies through untouched) — these classes document, not validate.

export class CreateWorkOrderRequest {
  @ApiProperty({ example: 'Leaking tap in kitchen', maxLength: 200 })
  title!: string;

  @ApiProperty({ example: 'Constant drip under the sink' })
  description!: string;

  @ApiProperty({ format: 'uuid' })
  propertyId!: string;

  @ApiPropertyOptional({
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  })
  priority?: string;
}

export class AssignWorkOrderRequest {
  @ApiProperty({ format: 'uuid' })
  assigneeId!: string;
}

export class UpdateWorkOrderStatusRequest {
  @ApiProperty({ enum: ['in_progress', 'completed', 'cancelled'] })
  status!: string;
}

export class CreatePropertyRequest {
  @ApiProperty({ example: 'Riverside House' })
  name!: string;

  @ApiProperty({ example: '12 Thames Road' })
  addressLine1!: string;

  @ApiProperty({ example: 'London' })
  city!: string;

  @ApiProperty({ example: 'SE1 7TP' })
  postcode!: string;

  @ApiProperty({ example: 'manager@propflow.dev' })
  managerEmail!: string;
}
