import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EXCHANGES } from '@app/contracts';
import { OutboxEvent } from './outbox-event.entity';
import { WorkOrderAuditProducer } from './work-order-audit.producer';

const BATCH_SIZE = 20;

/**
 * The publishing half of the outbox: polls the unpublished tail and forwards
 * each event to RabbitMQ and the Kafka audit stream. Rows are claimed with
 * FOR UPDATE SKIP LOCKED, so multiple service instances can run relays
 * without publishing the same row twice (a crashed instance's rows are simply
 * picked up by the next tick elsewhere).
 *
 * Failure semantics: a broker error aborts the tick and rolls the batch's
 * published_at stamps back — the rows are retried next tick. That makes
 * delivery at-least-once, which is exactly what every consumer in the system
 * is already built for (idempotency via event_id).
 */
@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelay.name);
  private timer: NodeJS.Timeout | null = null;
  private draining = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly amqp: AmqpConnection,
    private readonly audit: WorkOrderAuditProducer,
  ) {}

  onApplicationBootstrap(): void {
    const intervalMs = parseInt(process.env.OUTBOX_POLL_MS ?? '500', 10);
    this.timer = setInterval(() => void this.drain(), intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async drain(): Promise<void> {
    if (this.draining) return; // a slow tick must not overlap the next one
    this.draining = true;
    try {
      await this.dataSource.transaction(async (manager) => {
        const rows = await manager
          .getRepository(OutboxEvent)
          .createQueryBuilder('outbox')
          .setLock('pessimistic_write')
          .setOnLocked('skip_locked')
          .where('outbox.publishedAt IS NULL')
          .orderBy('outbox.id', 'ASC')
          .take(BATCH_SIZE)
          .getMany();

        for (const row of rows) {
          await this.amqp.publish(EXCHANGES.EVENTS, row.type, row.payload, {
            persistent: true,
            messageId: row.eventId,
          });
          await this.audit.record(row.payload);
          await manager.update(OutboxEvent, row.id, {
            publishedAt: new Date(),
          });
        }
      });
    } catch (error) {
      this.logger.warn(
        `outbox drain failed, will retry: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.draining = false;
    }
  }
}
