import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicatorResult } from '@nestjs/terminus';

@Injectable()
export class RabbitMQHealthIndicator {
  constructor(private readonly amqp: AmqpConnection) {}

  check(key: string): HealthIndicatorResult {
    if (!this.amqp.managedConnection.isConnected()) {
      throw new HealthCheckError('rabbitmq is not connected', {
        [key]: { status: 'down' },
      });
    }
    return { [key]: { status: 'up' } };
  }
}
