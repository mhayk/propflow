import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../auth/auth.decorators';
import { ActivityClient } from '../clients/activity.client';
import { ActivityEventDto, ActivityPage, CursorPage } from '../http/api-types';

/**
 * Pass-through to the audit service's activity feed. Same rule as the other
 * pass-through routes: query validation lives with the service that owns the
 * data.
 */
@ApiTags('activity')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@ApiForbiddenResponse({ description: 'Role not allowed on this route' })
@Controller('activity')
export class ActivityController {
  constructor(private readonly activity: ActivityClient) {}

  @ApiOperation({
    summary: 'Read the audit activity feed',
    description:
      'Roles: manager. Keyset-paginated, newest first — follow nextCursor for the next page. Each entry names the actor (null for system-initiated events like AI triage).',
  })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'nextCursor from the previous page',
  })
  @ApiQuery({ name: 'workOrderId', required: false })
  @ApiOkResponse({ type: ActivityPage })
  @Roles('manager')
  @Get()
  list(
    @Query() query: Record<string, string>,
  ): Promise<CursorPage<ActivityEventDto>> {
    return this.activity.list(query);
  }
}
