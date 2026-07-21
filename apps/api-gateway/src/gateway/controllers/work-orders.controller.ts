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
import { WorkOrdersClient } from '../clients/work-orders.client';
import { Paginated, WorkOrderDto } from '../http/api-types';

/**
 * Pass-through routes. The gateway validates only what it owns (path shape);
 * payload validation lives with the service that owns the data - duplicating
 * it here would make every rule change a two-repo deployment.
 */
@Controller('work-orders')
export class WorkOrdersController {
  constructor(private readonly workOrders: WorkOrdersClient) {}

  @Post()
  create(@Body() body: unknown): Promise<WorkOrderDto> {
    return this.workOrders.create(body);
  }

  @Get()
  list(
    @Query() query: Record<string, string>,
  ): Promise<Paginated<WorkOrderDto>> {
    return this.workOrders.list(query);
  }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string): Promise<WorkOrderDto> {
    return this.workOrders.getById(id);
  }

  @Patch(':id/assign')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<WorkOrderDto> {
    return this.workOrders.assign(id, body);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ): Promise<WorkOrderDto> {
    return this.workOrders.updateStatus(id, body);
  }
}
