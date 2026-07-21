import { Injectable, Logger } from '@nestjs/common';

export interface Notification {
  recipient: string;
  subject: string;
  body: string;
}

/**
 * Abstraction over the delivery channel (email, SMS, push...). The consumer
 * depends on this token, so swapping the channel — or recording calls in
 * tests — never touches message-handling code.
 */
export abstract class NotificationSender {
  abstract send(notification: Notification): Promise<void>;
}

/** Stand-in channel until a real provider is integrated. */
@Injectable()
export class LoggingNotificationSender extends NotificationSender {
  private readonly logger = new Logger(LoggingNotificationSender.name);

  send(notification: Notification): Promise<void> {
    this.logger.log(
      `to=${notification.recipient} subject="${notification.subject}"`,
    );
    return Promise.resolve();
  }
}
