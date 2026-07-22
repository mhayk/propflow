import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkOrderEvent } from '@app/contracts';
import { AuditEvent } from './audit-event.entity';

@Injectable()
export class AuditIngestService {
  private readonly logger = new Logger(AuditIngestService.name);

  constructor(
    @InjectRepository(AuditEvent)
    private readonly repository: Repository<AuditEvent>,
  ) {}

  /**
   * Idempotent by construction: ON CONFLICT (event_id) DO NOTHING turns the
   * duplicates inherent to at-least-once delivery into no-ops, so replaying
   * the topic (or a consumer crash-and-retry) can never double-record.
   */
  async record(event: WorkOrderEvent): Promise<void> {
    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .into(AuditEvent)
      .values({
        eventId: event.eventId,
        eventType: event.type,
        workOrderId: event.data.workOrderId,
        propertyId: event.data.propertyId,
        correlationId: event.correlationId,
        occurredAt: new Date(event.occurredAt),
        payload: event.data as unknown as Record<string, unknown>,
      })
      .orIgnore()
      .execute();

    if (result.identifiers.length === 0) {
      this.logger.debug(`duplicate event ${event.eventId} ignored`);
    }
  }
}
