import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import type { ConsumeMessage } from 'amqplib';
import { EXCHANGES } from '@app/contracts';
import {
  MAX_ATTEMPTS,
  RETRY_DELAY_MS,
  retryQueue,
} from './messaging-resilience';

/**
 * Wraps a message handler with retry + dead-letter semantics. The original
 * message is always acked; on failure a copy is republished either to the
 * retry queue (delayed redelivery) or, once attempts are exhausted, to the
 * dead-letter exchange. Attempt count travels in the x-attempt header.
 */
@Injectable()
export class EventRetryHandler {
  private readonly logger = new Logger(EventRetryHandler.name);

  constructor(private readonly amqp: AmqpConnection) {}

  async handle(
    queue: string,
    event: object,
    message: ConsumeMessage,
    handler: () => Promise<void>,
  ): Promise<void> {
    try {
      await handler();
    } catch (error) {
      const attempt = this.attemptOf(message);

      if (attempt < MAX_ATTEMPTS) {
        this.logger.warn(
          `attempt ${attempt}/${MAX_ATTEMPTS} failed on ${queue}, retrying in ${RETRY_DELAY_MS}ms`,
        );
        await this.amqp.publish('', retryQueue(queue), event, {
          persistent: true,
          headers: { 'x-attempt': attempt + 1 },
        });
      } else {
        this.logger.error(
          `attempt ${attempt}/${MAX_ATTEMPTS} failed on ${queue}, dead-lettering`,
        );
        await this.amqp.publish(EXCHANGES.DEAD_LETTER, queue, event, {
          persistent: true,
          headers: {
            'x-attempt': attempt,
            'x-last-error':
              error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  }

  private attemptOf(message: ConsumeMessage): number {
    const raw: unknown = message.properties.headers?.['x-attempt'];
    return typeof raw === 'number' ? raw : 1;
  }
}
