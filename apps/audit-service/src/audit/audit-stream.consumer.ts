import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';
import { TOPICS, WorkOrderEvent } from '@app/contracts';
import { AuditIngestService } from './audit-ingest.service';

@Injectable()
export class AuditStreamConsumer
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(AuditStreamConsumer.name);
  private readonly consumer: Consumer;

  constructor(private readonly ingest: AuditIngestService) {
    const kafka = new Kafka({
      clientId: 'audit-service',
      brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
    });
    this.consumer = kafka.consumer({
      groupId: process.env.AUDIT_CONSUMER_GROUP ?? 'audit-service',
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.consumer.connect();
    // fromBeginning is what makes the audit log rebuildable: point a fresh
    // consumer group at the topic and the whole history streams back in.
    await this.consumer.subscribe({
      topic: TOPICS.WORK_ORDER_EVENTS,
      fromBeginning: true,
    });
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        const event = JSON.parse(message.value.toString()) as WorkOrderEvent;
        // A thrown error here means the offset is not committed and the
        // message is redelivered; ingest idempotency makes that safe.
        await this.ingest.record(event);
        this.logger.debug(`recorded ${event.type} (${event.eventId})`);
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
  }
}
