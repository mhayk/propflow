import { randomUUID } from 'node:crypto';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EXCHANGES, WORK_ORDER_EVENTS, WorkOrderEvent } from '@app/contracts';
import { AppModule } from './../src/app.module';
import {
  Notification,
  NotificationSender,
} from './../src/notifications/notification-sender';

class RecordingSender extends NotificationSender {
  readonly sent: Notification[] = [];

  send(notification: Notification): Promise<void> {
    this.sent.push(notification);
    return Promise.resolve();
  }
}

const until = async (predicate: () => boolean, timeoutMs = 10_000) => {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('condition not met in time');
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};

describe('Notifications event flow (e2e)', () => {
  let app: INestApplication;
  let amqp: AmqpConnection;
  const recorder = new RecordingSender();

  const publishEvent = (
    type: WorkOrderEvent['type'],
    title: string,
  ): Promise<void> => {
    const event: WorkOrderEvent = {
      eventId: randomUUID(),
      type,
      occurredAt: new Date().toISOString(),
      data: {
        workOrderId: randomUUID(),
        propertyId: randomUUID(),
        title,
        priority: 'high',
        status: 'open',
        assigneeId: null,
      },
    };
    return amqp.publish(EXCHANGES.EVENTS, type, event, { persistent: true });
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(NotificationSender)
      .useValue(recorder)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    amqp = app.get(AmqpConnection);
  });

  afterAll(async () => {
    await app.close();
  });

  it('delivers a published work-order.created event through the broker to the sender', async () => {
    const title = `e2e ${randomUUID()}`;

    await publishEvent(WORK_ORDER_EVENTS.CREATED, title);

    await until(() =>
      recorder.sent.some((n) => n.subject === `New work order: ${title}`),
    );
  });

  it('routes work-order.completed to the tenant notification', async () => {
    const title = `e2e ${randomUUID()}`;

    await publishEvent(WORK_ORDER_EVENTS.COMPLETED, title);

    await until(() =>
      recorder.sent.some(
        (n) =>
          n.subject === `Work order completed: ${title}` &&
          n.recipient.startsWith('tenant-of-'),
      ),
    );
  });
});
