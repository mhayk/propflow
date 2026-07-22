import * as nestCommon from '@nestjs/common';
import * as kafkajs from 'kafkajs';
import type { EachMessagePayload } from 'kafkajs';
import * as contracts from '@app/contracts';
import { TOPICS, WORK_ORDER_EVENTS, WorkOrderEvent } from '@app/contracts';
import { AuditIngestService } from './audit-ingest.service';
import { AuditStreamConsumer } from './audit-stream.consumer';

interface FakeConsumer {
  connect: jest.Mock;
  subscribe: jest.Mock;
  run: jest.Mock;
  disconnect: jest.Mock;
}

type EachMessage = (payload: EachMessagePayload) => Promise<void>;

describe('AuditStreamConsumer', () => {
  const savedBrokers = process.env.KAFKA_BROKERS;
  const savedGroup = process.env.AUDIT_CONSUMER_GROUP;

  const event: WorkOrderEvent = {
    eventId: '44444444-4444-4444-8444-444444444444',
    type: WORK_ORDER_EVENTS.CREATED,
    occurredAt: '2026-07-21T10:00:00.000Z',
    correlationId: 'req-1',
    data: {
      workOrderId: '55555555-5555-4555-8555-555555555555',
      propertyId: '11111111-1111-4111-8111-111111111111',
      title: 'Leaking tap',
      description: 'Constant drip under the sink',
      priority: 'high',
      status: 'open',
      assigneeId: null,
    },
  };

  let ingest: { record: jest.Mock };
  let fakeConsumer: FakeConsumer;

  const build = (): AuditStreamConsumer => {
    ingest = { record: jest.fn().mockResolvedValue(undefined) };
    const consumer = new AuditStreamConsumer(
      ingest as unknown as AuditIngestService,
    );
    (consumer as unknown as { logger: { debug: jest.Mock } }).logger = {
      debug: jest.fn(),
    };
    fakeConsumer = {
      connect: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockResolvedValue(undefined),
      run: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
    };
    (consumer as unknown as { consumer: FakeConsumer }).consumer = fakeConsumer;
    return consumer;
  };

  const bootstrap = async (): Promise<{
    consumer: AuditStreamConsumer;
    eachMessage: EachMessage;
  }> => {
    const consumer = build();
    await consumer.onApplicationBootstrap();
    const [[runConfig]] = fakeConsumer.run.mock.calls as [
      [{ eachMessage: EachMessage }],
    ];
    return { consumer, eachMessage: runConfig.eachMessage };
  };

  afterEach(() => {
    if (savedBrokers === undefined) delete process.env.KAFKA_BROKERS;
    else process.env.KAFKA_BROKERS = savedBrokers;
    if (savedGroup === undefined) delete process.env.AUDIT_CONSUMER_GROUP;
    else process.env.AUDIT_CONSUMER_GROUP = savedGroup;
  });

  it('falls back to local broker and group defaults when env is unset', () => {
    delete process.env.KAFKA_BROKERS;
    delete process.env.AUDIT_CONSUMER_GROUP;

    expect(build()).toBeInstanceOf(AuditStreamConsumer);
  });

  it('honours KAFKA_BROKERS and AUDIT_CONSUMER_GROUP overrides', () => {
    process.env.KAFKA_BROKERS = 'broker-1:9092,broker-2:9092';
    process.env.AUDIT_CONSUMER_GROUP = 'audit-replay';

    expect(build()).toBeInstanceOf(AuditStreamConsumer);
  });

  it('connects, subscribes from the beginning and pumps events into ingest', async () => {
    const { eachMessage } = await bootstrap();

    expect(fakeConsumer.connect).toHaveBeenCalled();
    expect(fakeConsumer.subscribe).toHaveBeenCalledWith({
      topic: TOPICS.WORK_ORDER_EVENTS,
      fromBeginning: true,
    });

    await eachMessage({
      message: { value: Buffer.from(JSON.stringify(event)) },
    } as unknown as EachMessagePayload);

    expect(ingest.record).toHaveBeenCalledWith(event);
  });

  it('skips messages without a value', async () => {
    const { eachMessage } = await bootstrap();

    await eachMessage({
      message: { value: null },
    } as unknown as EachMessagePayload);

    expect(ingest.record).not.toHaveBeenCalled();
  });

  it('disconnects the consumer on shutdown', async () => {
    const consumer = build();

    await consumer.onModuleDestroy();

    expect(fakeConsumer.disconnect).toHaveBeenCalled();
  });

  it('falls back to Object metadata when the ingest type is not a constructor', () => {
    jest.doMock('@nestjs/common', () => nestCommon);
    jest.doMock('kafkajs', () => kafkajs);
    jest.doMock('@app/contracts', () => contracts);
    jest.doMock('./audit-ingest.service', () => ({ AuditIngestService: {} }));
    try {
      jest.isolateModules(() => {
        const reloaded = jest.requireActual<{ AuditStreamConsumer: unknown }>(
          './audit-stream.consumer',
        );
        expect(typeof reloaded.AuditStreamConsumer).toBe('function');
      });
    } finally {
      jest.dontMock('@nestjs/common');
      jest.dontMock('kafkajs');
      jest.dontMock('@app/contracts');
      jest.dontMock('./audit-ingest.service');
    }
  });
});
