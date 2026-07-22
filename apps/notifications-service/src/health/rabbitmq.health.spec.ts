import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckError } from '@nestjs/terminus';
import { RabbitMQHealthIndicator } from './rabbitmq.health';

describe('RabbitMQHealthIndicator', () => {
  let indicator: RabbitMQHealthIndicator;
  let isConnected: jest.Mock;

  beforeEach(async () => {
    isConnected = jest.fn();
    const amqp = { managedConnection: { isConnected } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RabbitMQHealthIndicator,
        { provide: AmqpConnection, useValue: amqp },
      ],
    }).compile();

    indicator = module.get(RabbitMQHealthIndicator);
  });

  it('reports up while the managed connection is connected', () => {
    isConnected.mockReturnValue(true);

    expect(indicator.check('rabbitmq')).toEqual({
      rabbitmq: { status: 'up' },
    });
  });

  it('throws a HealthCheckError when the connection is down', () => {
    isConnected.mockReturnValue(false);

    let caught: unknown;
    try {
      indicator.check('rabbitmq');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(HealthCheckError);
    expect((caught as HealthCheckError).causes).toEqual({
      rabbitmq: { status: 'down' },
    });
  });

  it('falls back to Object metadata when AmqpConnection is not defined at load time', () => {
    // emitDecoratorMetadata guards each constructor param type with
    // `typeof X !== "undefined" ? X : Object`; re-evaluate the module without
    // AmqpConnection to execute the fallback side of that guard.
    let isolated: typeof import('./rabbitmq.health') | undefined;

    jest.isolateModules(() => {
      jest.doMock('@golevelup/nestjs-rabbitmq', () => ({}));
      isolated =
        jest.requireActual<typeof import('./rabbitmq.health')>(
          './rabbitmq.health',
        );
    });
    jest.dontMock('@golevelup/nestjs-rabbitmq');

    expect(isolated?.RabbitMQHealthIndicator).toBeDefined();
  });
});
