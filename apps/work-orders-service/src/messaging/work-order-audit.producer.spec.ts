import { TOPICS, WORK_ORDER_EVENTS, WorkOrderEvent } from '@app/contracts';
import { WorkOrderAuditProducer } from './work-order-audit.producer';

type FakeKafkaProducer = {
  connect: jest.Mock;
  disconnect: jest.Mock;
  send: jest.Mock;
};

const event: WorkOrderEvent = {
  eventId: '44444444-4444-4444-8444-444444444444',
  type: WORK_ORDER_EVENTS.CREATED,
  occurredAt: '2026-07-22T10:00:00.000Z',
  correlationId: null,
  data: {
    workOrderId: '55555555-5555-4555-8555-555555555555',
    propertyId: '11111111-1111-4111-8111-111111111111',
    title: 'Leaking tap',
    description: 'Drip',
    priority: 'medium',
    status: 'open',
    assigneeId: null,
  },
};

// The constructor builds a real (offline-safe) kafkajs client; the specs swap
// the private producer for a fake so no broker is ever contacted.
const buildProducer = (): {
  producer: WorkOrderAuditProducer;
  fake: FakeKafkaProducer;
} => {
  const producer = new WorkOrderAuditProducer();
  const fake: FakeKafkaProducer = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue(undefined),
  };
  (producer as unknown as { producer: FakeKafkaProducer }).producer = fake;
  return { producer, fake };
};

describe('WorkOrderAuditProducer', () => {
  const originalBrokers = process.env.KAFKA_BROKERS;

  afterEach(() => {
    if (originalBrokers === undefined) delete process.env.KAFKA_BROKERS;
    else process.env.KAFKA_BROKERS = originalBrokers;
  });

  it('constructs against the default local broker when KAFKA_BROKERS is unset', () => {
    delete process.env.KAFKA_BROKERS;

    expect(() => new WorkOrderAuditProducer()).not.toThrow();
  });

  it('constructs against the comma-separated KAFKA_BROKERS list', () => {
    process.env.KAFKA_BROKERS = 'kafka-1:9092,kafka-2:9092';

    expect(() => new WorkOrderAuditProducer()).not.toThrow();
  });

  it('connects the producer on module init', async () => {
    const { producer, fake } = buildProducer();

    await producer.onModuleInit();

    expect(fake.connect).toHaveBeenCalledTimes(1);
  });

  it('swallows a failed connect so a broken broker cannot stop the service', async () => {
    const { producer, fake } = buildProducer();
    fake.connect.mockRejectedValue(new Error('broker unreachable'));

    await expect(producer.onModuleInit()).resolves.toBeUndefined();
  });

  it('swallows a non-Error connect failure the same way', async () => {
    const { producer, fake } = buildProducer();
    fake.connect.mockRejectedValue('broker unreachable');

    await expect(producer.onModuleInit()).resolves.toBeUndefined();
  });

  it('disconnects the producer on module destroy', async () => {
    const { producer, fake } = buildProducer();

    await producer.onModuleDestroy();

    expect(fake.disconnect).toHaveBeenCalledTimes(1);
  });

  it('appends events to the audit topic keyed by the work order id', async () => {
    const { producer, fake } = buildProducer();

    await producer.record(event);

    expect(fake.send).toHaveBeenCalledWith({
      topic: TOPICS.WORK_ORDER_EVENTS,
      messages: [{ key: event.data.workOrderId, value: JSON.stringify(event) }],
    });
  });

  it('propagates a send failure so the relay leaves the row unpublished', async () => {
    const { producer, fake } = buildProducer();
    fake.send.mockRejectedValue(new Error('leader not available'));

    await expect(producer.record(event)).rejects.toThrow(
      'leader not available',
    );
  });
});
