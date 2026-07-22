import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { PropertiesClient } from '../clients/properties.client';
import {
  CreatePropertyRequest,
  Paginated,
  PropertyDto,
  PropertyPage,
} from '../http/api-types';

@ApiTags('properties')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@ApiForbiddenResponse({ description: 'Role not allowed on this route' })
@Controller('properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesClient) {}

  @ApiOperation({
    summary: 'Register a property',
    description: 'Roles: manager.',
  })
  @ApiBody({ type: CreatePropertyRequest })
  @ApiCreatedResponse({ type: PropertyDto })
  @Roles('manager')
  @Post()
  create(@Body() body: unknown): Promise<PropertyDto> {
    return this.properties.create(body);
  }

  @ApiOperation({
    summary: 'List properties',
    description: 'Roles: any authenticated user.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiOkResponse({ type: PropertyPage })
  @Get()
  list(
    @Query() query: Record<string, string>,
  ): Promise<Paginated<PropertyDto>> {
    return this.properties.list(query);
  }

  @ApiOperation({
    summary: 'Get one property',
    description: 'Roles: any authenticated user.',
  })
  @ApiOkResponse({ type: PropertyDto })
  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string): Promise<PropertyDto> {
    return this.properties.getById(id);
  }
}
