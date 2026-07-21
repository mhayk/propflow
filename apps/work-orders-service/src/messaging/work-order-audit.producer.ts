import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { TOPICS, WorkOrderEvent } from '@app/contracts';

/**
 * Appends every domain event to the Kafka audit stream, keyed by the
 * aggregate id: all events of one work order share a partition and so keep
 * their order. Best-effort like the RabbitMQ publisher: audit must never
 * take the write path down.
 */
@Injectable()
export class WorkOrderAuditProducer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkOrderAuditProducer.name);
  private readonly producer: Producer;

  constructor() {
    const kafka = new Kafka({
      clientId: 'work-orders-service',
      brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
    });
    this.producer = kafka.producer({ allowAutoTopicCreation: true });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.producer.connect();
    } catch (error) {
      this.logger.error(
        'kafka connect failed, audit records will be dropped',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.producer.disconnect();
  }

  async record(event: WorkOrderEvent): Promise<void> {
    try {
      await this.producer.send({
        topic: TOPICS.WORK_ORDER_EVENTS,
        messages: [
          { key: event.data.workOrderId, value: JSON.stringify(event) },
        ],
      });
    } catch (error) {
      this.logger.error(
        `failed to append ${event.type} (${event.eventId}) to the audit stream`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
