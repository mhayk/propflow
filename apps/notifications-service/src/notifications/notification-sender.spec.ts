import { Logger } from '@nestjs/common';
import {
  LoggingNotificationSender,
  Notification,
  NotificationSender,
} from './notification-sender';

describe('LoggingNotificationSender', () => {
  const notification: Notification = {
    recipient: 'manager-of-11111111-1111-4111-8111-111111111111',
    subject: 'New work order: Leaking tap in kitchen',
    body: 'A high priority work order was opened.',
  };

  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('is a NotificationSender', () => {
    expect(new LoggingNotificationSender()).toBeInstanceOf(NotificationSender);
  });

  it('logs the recipient and subject instead of delivering', async () => {
    const sender = new LoggingNotificationSender();

    await expect(sender.send(notification)).resolves.toBeUndefined();

    expect(logSpy).toHaveBeenCalledWith(
      'to=manager-of-11111111-1111-4111-8111-111111111111 subject="New work order: Leaking tap in kitchen"',
    );
  });
});
