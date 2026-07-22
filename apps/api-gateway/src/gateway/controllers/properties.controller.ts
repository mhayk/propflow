import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../../auth/auth.decorators';
import { PropertiesClient } from '../clients/properties.client';
import { Paginated, PropertyDto } from '../http/api-types';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesClient) {}

  @Roles('manager')
  @Post()
  create(@Body() body: unknown): Promise<PropertyDto> {
    return this.properties.create(body);
  }

  @Get()
  list(
    @Query() query: Record<string, string>,
  ): Promise<Paginated<PropertyDto>> {
    return this.properties.list(query);
  }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string): Promise<PropertyDto> {
    return this.properties.getById(id);
  }
}
