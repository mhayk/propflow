import { EXCHANGES } from '@app/contracts';
import {
  MAX_ATTEMPTS,
  RETRY_DELAY_MS,
  deadLetterQueue,
  resilienceQueues,
  retryQueue,
} from './messaging-resilience';

describe('messaging-resilience', () => {
  const QUEUE = 'notifications.work-order-created';

  it('derives the retry and dead-letter queue names from the main queue', () => {
    expect(retryQueue(QUEUE)).toBe('notifications.work-order-created.retry');
    expect(deadLetterQueue(QUEUE)).toBe('notifications.work-order-created.dlq');
  });

  it('builds a TTL retry queue that dead-letters back to the main queue', () => {
    const [retry] = resilienceQueues(QUEUE);

    expect(retry).toEqual({
      name: 'notifications.work-order-created.retry',
      options: {
        durable: true,
        messageTtl: RETRY_DELAY_MS,
        deadLetterExchange: '',
        deadLetterRoutingKey: QUEUE,
      },
    });
  });

  it('builds a durable parking queue bound to the dead-letter exchange', () => {
    const [, dlq] = resilienceQueues(QUEUE);

    expect(dlq).toEqual({
      name: 'notifications.work-order-created.dlq',
      exchange: EXCHANGES.DEAD_LETTER,
      routingKey: QUEUE,
      options: { durable: true },
    });
  });

  it('waits 5s between attempts and gives up after 3', () => {
    expect(RETRY_DELAY_MS).toBe(5_000);
    expect(MAX_ATTEMPTS).toBe(3);
  });
});
