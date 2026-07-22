import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PropertySummaryDto } from '../http/api-types';
import {
  PropertySummary,
  PropertySummaryService,
} from './property-summary.service';

@ApiTags('properties')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@Controller('properties')
export class PropertySummaryController {
  constructor(private readonly summaryService: PropertySummaryService) {}

  @ApiOperation({
    summary: 'Property summary (composed)',
    description:
      'Roles: any authenticated user. Composes properties + work-orders; degrades gracefully when work-orders is down (flow 6).',
  })
  @ApiOkResponse({ type: PropertySummaryDto })
  @Get(':id/summary')
  getSummary(@Param('id', ParseUUIDPipe) id: string): Promise<PropertySummary> {
    return this.summaryService.getSummary(id);
  }
}
