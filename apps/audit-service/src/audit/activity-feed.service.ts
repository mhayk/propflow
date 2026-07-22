import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEvent } from './audit-event.entity';
import { ListActivityQueryDto } from './dto/list-activity-query.dto';

export interface ActivityItem {
  id: string;
  eventType: string;
  workOrderId: string;
  propertyId: string;
  correlationId: string | null;
  actorId: string | null;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface ActivityPage {
  data: ActivityItem[];
  nextCursor: string | null;
}

@Injectable()
export class ActivityFeedService {
  constructor(
    @InjectRepository(AuditEvent)
    private readonly repository: Repository<AuditEvent>,
  ) {}

  /**
   * Keyset (cursor) pagination, newest first. Unlike offset/limit, a page
   * boundary is pinned to a row id, so events appended between requests can
   * never shift or duplicate rows across pages — the property an
   * infinite-scroll feed needs. Fetching limit+1 rows answers "is there a
   * next page" without a separate COUNT over the whole log.
   */
  async list(query: ListActivityQueryDto): Promise<ActivityPage> {
    const qb = this.repository
      .createQueryBuilder('event')
      .orderBy('event.id', 'DESC')
      .take(query.limit + 1);

    if (query.cursor) {
      qb.andWhere('event.id < :cursor', { cursor: query.cursor });
    }
    if (query.workOrderId) {
      qb.andWhere('event.workOrderId = :workOrderId', {
        workOrderId: query.workOrderId,
      });
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      data: page.map((row) => ({
        id: row.id,
        eventType: row.eventType,
        workOrderId: row.workOrderId,
        propertyId: row.propertyId,
        correlationId: row.correlationId,
        actorId: row.actorId,
        occurredAt: row.occurredAt.toISOString(),
        payload: row.payload,
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }
}
