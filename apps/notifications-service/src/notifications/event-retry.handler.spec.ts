import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Test, TestingModule } from '@nestjs/testing';
import type { ConsumeMessage } from 'amqplib';
import { EXCHANGES } from '@app/contracts';
import { EventRetryHandler } from './event-retry.handler';

describe('EventRetryHandler', () => {
  let handler: EventRetryHandler;
  let amqp: { publish: jest.Mock };

  const QUEUE = 'notifications.work-order-created';
  const event = { eventId: 'evt-1' };

  const messageWithAttempt = (attempt?: number): ConsumeMessage => ({
    properties: {
      headers: attempt === undefined ? {} : { 'x-attempt': attempt },
    },
  });

  beforeEach(async () => {
    amqp = { publish: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventRetryHandler,
        { provide: AmqpConnection, useValue: amqp },
      ],
    }).compile();

    handler = module.get(EventRetryHandler);
  });

  it('does not republish when the handler succeeds', async () => {
    await handler.handle(QUEUE, event, messageWithAttempt(), () =>
      Promise.resolve(),
    );

    expect(amqp.publish).not.toHaveBeenCalled();
  });

  it('schedules a retry with an incremented attempt on first failure', async () => {
    await handler.handle(QUEUE, event, messageWithAttempt(), () =>
      Promise.reject(new Error('smtp down')),
    );

    expect(amqp.publish).toHaveBeenCalledWith(
      '',
      `${QUEUE}.retry`,
      event,
      expect.objectContaining({ headers: { 'x-attempt': 2 } }),
    );
  });

  it('dead-letters once attempts are exhausted', async () => {
    await handler.handle(QUEUE, event, messageWithAttempt(3), () =>
      Promise.reject(new Error('smtp down')),
    );

    expect(amqp.publish).toHaveBeenCalledWith(
      EXCHANGES.DEAD_LETTER,
      QUEUE,
      event,
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-attempt': 3,
          'x-last-error': 'smtp down',
        }) as Record<string, unknown>,
      }),
    );
  });

  it('never throws back to the transport (the original message is acked)', async () => {
    amqp.publish.mockRejectedValue(new Error('broker gone'));

    await expect(
      handler.handle(QUEUE, event, messageWithAttempt(), () =>
        Promise.reject(new Error('boom')),
      ),
    ).rejects.toThrow('broker gone');
  });
});
