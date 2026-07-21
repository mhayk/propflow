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
import { AssignWorkOrderDto } from './dto/assign-work-order.dto';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderStatusDto } from './dto/update-work-order-status.dto';
import { PaginatedResult } from './dto/paginated-result';
import { QueryWorkOrdersDto } from './dto/query-work-orders.dto';
import { WorkOrder } from './work-order.entity';
import { WorkOrdersService } from './work-orders.service';

@Controller('work-orders')
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Post()
  create(@Body() dto: CreateWorkOrderDto): Promise<WorkOrder> {
    return this.workOrdersService.create(dto);
  }

  @Get()
  findAll(
    @Query() query: QueryWorkOrdersDto,
  ): Promise<PaginatedResult<WorkOrder>> {
    return this.workOrdersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<WorkOrder> {
    return this.workOrdersService.findOne(id);
  }

  @Patch(':id/assign')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignWorkOrderDto,
  ): Promise<WorkOrder> {
    return this.workOrdersService.assign(id, dto.assigneeId);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkOrderStatusDto,
  ): Promise<WorkOrder> {
    return this.workOrdersService.updateStatus(id, dto.status);
  }
}
