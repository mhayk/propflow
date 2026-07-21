import { RabbitMQQueueConfig } from '@golevelup/nestjs-rabbitmq';
import { EXCHANGES } from '@app/contracts';

export const RETRY_DELAY_MS = 5_000;
export const MAX_ATTEMPTS = 3;

export const retryQueue = (queue: string): string => `${queue}.retry`;
export const deadLetterQueue = (queue: string): string => `${queue}.dlq`;

/**
 * Retry topology for one consumer queue, using the classic TTL pattern:
 *
 *   main queue --handler fails--> <queue>.retry (no consumer, TTL 5s)
 *        ^                              |
 *        └── x-dead-letter back to ─────┘
 *
 * The retry queue has no consumers; messages sit there until the TTL expires,
 * then RabbitMQ dead-letters them through the default exchange straight back
 * to the main queue (routing key = queue name). After MAX_ATTEMPTS the message
 * is parked in <queue>.dlq for inspection and manual replay.
 */
export function resilienceQueues(queue: string): RabbitMQQueueConfig[] {
  return [
    {
      name: retryQueue(queue),
      options: {
        durable: true,
        messageTtl: RETRY_DELAY_MS,
        deadLetterExchange: '',
        deadLetterRoutingKey: queue,
      },
    },
    {
      name: deadLetterQueue(queue),
      exchange: EXCHANGES.DEAD_LETTER,
      routingKey: queue,
      options: { durable: true },
    },
  ];
}
