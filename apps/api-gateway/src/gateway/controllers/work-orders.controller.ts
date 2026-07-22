import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../auth/auth.decorators';
import { WorkOrdersClient } from '../clients/work-orders.client';
import {
  AssignWorkOrderRequest,
  CreateWorkOrderRequest,
  Paginated,
  UpdateWorkOrderStatusRequest,
  WorkOrderDto,
  WorkOrderPage,
} from '../http/api-types';

/**
 * Pass-through routes. The gateway validates only what it owns (path shape,
 * and now authorization — roles map to the actors in docs/flows.md); payload
 * validation lives with the service that owns the data.
 */
@ApiTags('work-orders')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@ApiForbiddenResponse({ description: 'Role not allowed on this route' })
@Controller('work-orders')
export class WorkOrdersController {
  constructor(private readonly workOrders: WorkOrdersClient) {}

  @ApiOperation({
    summary: 'Open a maintenance request',
    description:
      'Roles: tenant, manager. Triage fields come back null — AI classification runs asynchronously (flow 4).',
  })
  @ApiBody({ type: CreateWorkOrderRequest })
  @ApiCreatedResponse({ type: WorkOrderDto })
  @Roles('tenant', 'manager')
  @Post()
  create(@Body() body: unknown): Promise<WorkOrderDto> {
    return this.workOrders.create(body);
  }

  @ApiOperation({
    summary: 'List work orders',
    description: 'Roles: any authenticated user.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['open', 'assigned', 'in_progress', 'completed', 'cancelled'],
  })
  @ApiQuery({
    name: 'priority',
    required: false,
    enum: ['low', 'medium', 'high', 'urgent'],
  })
  @ApiQuery({ name: 'propertyId', required: false })
  @ApiOkResponse({ type: WorkOrderPage })
  @Get()
  list(
    @Query() query: Record<string, string>,
  ): Promise<Paginated<WorkOrderDto>> {
    return this.workOrders.list(query);
  }

  @ApiOperation({
    summary: 'Get one work order',
    description: 'Roles: any authenticated user.',
  })
  @ApiOkResponse({ type: WorkOrderDto })
  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string): Promise<WorkOrderDto> {
    return this.workOrders.getById(id);
  }

  @ApiOperation({
    summary: 'Assign a technician',
    description:
      "Roles: manager. The only way into the 'assigned' state — guarantees an assignee exists.",
  })
  @ApiBody({ type: AssignWorkOrderRequest })
  @ApiOkResponse({ type: WorkOrderDto })
  @Roles('manager')
  @Patch(':id/assign')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<WorkOrderDto> {
    return this.workOrders.assign(id, body);
  }

  @ApiOperation({
    summary: 'Move a work order through its lifecycle',
    description:
      'Roles: technician, manager. Transitions are guarded by the state machine (flow 8); invalid ones return 409.',
  })
  @ApiBody({ type: UpdateWorkOrderStatusRequest })
  @ApiOkResponse({ type: WorkOrderDto })
  @Roles('technician', 'manager')
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<WorkOrderDto> {
    return this.workOrders.updateStatus(id, body);
  }
}
