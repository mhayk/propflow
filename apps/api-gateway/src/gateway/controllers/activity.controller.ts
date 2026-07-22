import { Controller, Get, Query } from '@nestjs/common';
import { ActivityClient } from '../clients/activity.client';
import { ActivityEventDto, CursorPage } from '../http/api-types';

/**
 * Pass-through to the audit service's activity feed. Same rule as the other
 * pass-through routes: query validation lives with the service that owns the
 * data.
 */
@Controller('activity')
export class ActivityController {
  constructor(private readonly activity: ActivityClient) {}

  @Get()
  list(
    @Query() query: Record<string, string>,
  ): Promise<CursorPage<ActivityEventDto>> {
    return this.activity.list(query);
  }
}
