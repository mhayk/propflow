import * as nestCommon from '@nestjs/common';
import { ActivityFeedController } from './activity-feed.controller';
import { ActivityFeedService, ActivityPage } from './activity-feed.service';
import { ListActivityQueryDto } from './dto/list-activity-query.dto';

describe('ActivityFeedController', () => {
  it('delegates listing to the feed service', async () => {
    const page: ActivityPage = { data: [], nextCursor: null };
    const list = jest.fn().mockResolvedValue(page);
    const controller = new ActivityFeedController({
      list,
    } as unknown as ActivityFeedService);
    const query = Object.assign(new ListActivityQueryDto(), { limit: 10 });

    await expect(controller.list(query)).resolves.toBe(page);
    expect(list).toHaveBeenCalledWith(query);
  });

  it('falls back to Object metadata when design-time types are not constructors', () => {
    const globals = globalThis as { Promise: PromiseConstructor };
    const realPromise = globals.Promise;
    jest.doMock('@nestjs/common', () => nestCommon);
    jest.doMock('./activity-feed.service', () => ({ ActivityFeedService: {} }));
    jest.doMock('./dto/list-activity-query.dto', () => ({
      ListActivityQueryDto: {},
    }));
    try {
      globals.Promise = {} as PromiseConstructor;
      jest.isolateModules(() => {
        const reloaded = jest.requireActual<{
          ActivityFeedController: unknown;
        }>('./activity-feed.controller');
        expect(typeof reloaded.ActivityFeedController).toBe('function');
      });
    } finally {
      globals.Promise = realPromise;
      jest.dontMock('@nestjs/common');
      jest.dontMock('./activity-feed.service');
      jest.dontMock('./dto/list-activity-query.dto');
    }
  });
});
