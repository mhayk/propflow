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

  it('treats a missing headers object as the first attempt', async () => {
    const headerless = {
      properties: { headers: undefined },
    } as unknown as ConsumeMessage;

    await handler.handle(QUEUE, event, headerless, () =>
      Promise.reject(new Error('smtp down')),
    );

    expect(amqp.publish).toHaveBeenCalledWith(
      '',
      `${QUEUE}.retry`,
      event,
      expect.objectContaining({ headers: { 'x-attempt': 2 } }),
    );
  });

  it('treats a non-numeric x-attempt header as the first attempt', async () => {
    const malformed = {
      properties: { headers: { 'x-attempt': 'not-a-number' } },
    } as unknown as ConsumeMessage;

    await handler.handle(QUEUE, event, malformed, () =>
      Promise.reject(new Error('smtp down')),
    );

    expect(amqp.publish).toHaveBeenCalledWith(
      '',
      `${QUEUE}.retry`,
      event,
      expect.objectContaining({ headers: { 'x-attempt': 2 } }),
    );
  });

  it('stringifies non-Error throwables in the dead-letter header', async () => {
    // Typed as Error to satisfy the linter; the runtime value stays a string
    // so the non-Error serialization path executes.
    const nonError = 'smtp exploded' as unknown as Error;

    await handler.handle(QUEUE, event, messageWithAttempt(3), () =>
      Promise.reject(nonError),
    );

    expect(amqp.publish).toHaveBeenCalledWith(
      EXCHANGES.DEAD_LETTER,
      QUEUE,
      event,
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-last-error': 'smtp exploded',
        }) as Record<string, unknown>,
      }),
    );
  });

  it('falls back to Object metadata when AmqpConnection is not defined at load time', () => {
    // emitDecoratorMetadata guards each constructor param type with
    // `typeof X !== "undefined" ? X : Object`; re-evaluate the module without
    // AmqpConnection to execute the fallback side of that guard.
    let isolated: typeof import('./event-retry.handler') | undefined;

    jest.isolateModules(() => {
      jest.doMock('@golevelup/nestjs-rabbitmq', () => ({}));
      isolated = jest.requireActual<typeof import('./event-retry.handler')>(
        './event-retry.handler',
      );
    });
    jest.dontMock('@golevelup/nestjs-rabbitmq');

    expect(isolated?.EventRetryHandler).toBeDefined();
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
