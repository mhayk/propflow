import { Controller, Get, Query } from '@nestjs/common';
import { ActivityFeedService, ActivityPage } from './activity-feed.service';
import { ListActivityQueryDto } from './dto/list-activity-query.dto';

@Controller('activity')
export class ActivityFeedController {
  constructor(private readonly feed: ActivityFeedService) {}

  @Get()
  list(@Query() query: ListActivityQueryDto): Promise<ActivityPage> {
    return this.feed.list(query);
  }
}
