import { Test, TestingModule } from '@nestjs/testing';
import {
  HealthCheckResult,
  HealthCheckService,
  HealthIndicatorFunction,
} from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RabbitMQHealthIndicator } from './rabbitmq.health';

describe('HealthController (notifications)', () => {
  let controller: HealthController;
  let health: { check: jest.Mock };
  let rabbit: { check: jest.Mock };

  const healthy: HealthCheckResult = {
    status: 'ok',
    info: { rabbitmq: { status: 'up' } },
    error: {},
    details: { rabbitmq: { status: 'up' } },
  };

  beforeEach(async () => {
    rabbit = {
      check: jest.fn().mockReturnValue({ rabbitmq: { status: 'up' } }),
    };
    health = {
      // Run every indicator, as terminus would, so the arrow wiring executes.
      check: jest.fn(async (indicators: HealthIndicatorFunction[]) => {
        for (const indicator of indicators) await indicator();
        return healthy;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: health },
        { provide: RabbitMQHealthIndicator, useValue: rabbit },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('reports liveness unconditionally', () => {
    expect(controller.live()).toEqual({ status: 'ok' });
  });

  it('delegates readiness to the rabbitmq indicator', async () => {
    await expect(controller.ready()).resolves.toBe(healthy);

    expect(health.check).toHaveBeenCalledTimes(1);
    expect(rabbit.check).toHaveBeenCalledWith('rabbitmq');
  });

  it('falls back to Object metadata when types are not defined at load time', () => {
    // emitDecoratorMetadata guards every serialized type reference (ctor param
    // types and decorated-method return types) with
    // `typeof X !== "undefined" ? X : Object`; re-evaluate the module without
    // those globals/classes to execute the fallback side of each guard. All
    // dependencies are captured up front so nothing else evaluates while the
    // Promise global is missing.
    const common =
      jest.requireActual<typeof import('@nestjs/common')>('@nestjs/common');
    const terminus =
      jest.requireActual<typeof import('@nestjs/terminus')>('@nestjs/terminus');
    let isolated: typeof import('./health.controller') | undefined;

    jest.isolateModules(() => {
      jest.doMock('@nestjs/common', () => common);
      jest.doMock('@nestjs/terminus', () => ({
        ...terminus,
        HealthCheckService: undefined,
      }));
      jest.doMock('./rabbitmq.health', () => ({}));
      const globals = globalThis as { Promise?: PromiseConstructor };
      const originalPromise = globals.Promise;
      delete globals.Promise;
      try {
        isolated = jest.requireActual<typeof import('./health.controller')>(
          './health.controller',
        );
      } finally {
        globals.Promise = originalPromise;
      }
    });
    jest.dontMock('@nestjs/common');
    jest.dontMock('@nestjs/terminus');
    jest.dontMock('./rabbitmq.health');

    expect(isolated?.HealthController).toBeDefined();
  });
});
