import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PaginatedResult } from './dto/paginated-result';
import { QueryPropertiesDto } from './dto/query-properties.dto';
import { PropertiesService } from './properties.service';
import { Property } from './property.entity';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post()
  create(@Body() dto: CreatePropertyDto): Promise<Property> {
    return this.propertiesService.create(dto);
  }

  @Get()
  findAll(
    @Query() query: QueryPropertiesDto,
  ): Promise<PaginatedResult<Property>> {
    return this.propertiesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Property> {
    return this.propertiesService.findOne(id);
  }
}
