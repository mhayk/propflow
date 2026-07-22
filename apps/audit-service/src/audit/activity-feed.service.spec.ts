import * as nestCommon from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as nestTypeorm from '@nestjs/typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ActivityFeedService } from './activity-feed.service';
import * as entityModule from './audit-event.entity';
import { AuditEvent } from './audit-event.entity';
import { ListActivityQueryDto } from './dto/list-activity-query.dto';

const row = (id: number): AuditEvent => ({
  id: String(id),
  eventId: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
  eventType: 'work-order.created',
  workOrderId: '55555555-5555-4555-8555-555555555555',
  propertyId: '11111111-1111-4111-8111-111111111111',
  correlationId: null,
  actorId: null,
  occurredAt: new Date('2026-07-21T10:00:00.000Z'),
  payload: {},
  recordedAt: new Date('2026-07-21T10:00:01.000Z'),
});

describe('ActivityFeedService', () => {
  let service: ActivityFeedService;
  let builder: {
    orderBy: jest.Mock;
    take: jest.Mock;
    andWhere: jest.Mock;
    getMany: jest.Mock;
  };

  const query = (
    overrides: Partial<ListActivityQueryDto>,
  ): ListActivityQueryDto =>
    Object.assign(new ListActivityQueryDto(), overrides);

  beforeEach(async () => {
    builder = {
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const repository = { createQueryBuilder: () => builder };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityFeedService,
        { provide: getRepositoryToken(AuditEvent), useValue: repository },
      ],
    }).compile();

    service = module.get(ActivityFeedService);
  });

  it('returns a full page plus the cursor when more rows exist', async () => {
    builder.getMany.mockResolvedValue([row(30), row(29), row(28)]);

    const page = await service.list(query({ limit: 2 }));

    expect(builder.take).toHaveBeenCalledWith(3);
    expect(page.data.map((item) => item.id)).toEqual(['30', '29']);
    expect(page.nextCursor).toBe('29');
  });

  it('signals the end of the feed with a null cursor', async () => {
    builder.getMany.mockResolvedValue([row(2), row(1)]);

    const page = await service.list(query({ limit: 2 }));

    expect(page.nextCursor).toBeNull();
  });

  it('applies cursor and work-order filters as keyset predicates', async () => {
    await service.list(
      query({
        limit: 20,
        cursor: '28',
        workOrderId: '55555555-5555-4555-8555-555555555555',
      }),
    );

    expect(builder.andWhere).toHaveBeenCalledWith('event.id < :cursor', {
      cursor: '28',
    });
    expect(builder.andWhere).toHaveBeenCalledWith(
      'event.workOrderId = :workOrderId',
      { workOrderId: '55555555-5555-4555-8555-555555555555' },
    );
  });

  it('falls back to Object metadata when the repository type is not a constructor', () => {
    jest.doMock('@nestjs/common', () => nestCommon);
    jest.doMock('@nestjs/typeorm', () => nestTypeorm);
    jest.doMock('typeorm', () => ({ Repository: {} }));
    jest.doMock('./audit-event.entity', () => entityModule);
    try {
      jest.isolateModules(() => {
        const reloaded = jest.requireActual<{ ActivityFeedService: unknown }>(
          './activity-feed.service',
        );
        expect(typeof reloaded.ActivityFeedService).toBe('function');
      });
    } finally {
      jest.dontMock('@nestjs/common');
      jest.dontMock('@nestjs/typeorm');
      jest.dontMock('typeorm');
      jest.dontMock('./audit-event.entity');
    }
  });
});
