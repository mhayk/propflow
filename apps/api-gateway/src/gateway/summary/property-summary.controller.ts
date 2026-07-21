import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  PropertySummary,
  PropertySummaryService,
} from './property-summary.service';

@Controller('properties')
export class PropertySummaryController {
  constructor(private readonly summaryService: PropertySummaryService) {}

  @Get(':id/summary')
  getSummary(@Param('id', ParseUUIDPipe) id: string): Promise<PropertySummary> {
    return this.summaryService.getSummary(id);
  }
}
