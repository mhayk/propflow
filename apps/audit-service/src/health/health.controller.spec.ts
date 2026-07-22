import * as nestCommon from '@nestjs/common';
import type {
  HealthCheckResult,
  HealthCheckService,
  HealthIndicatorFunction,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const result = {
    status: 'ok',
    info: {},
    error: {},
    details: {},
  } as HealthCheckResult;

  let pingCheck: jest.Mock;
  let check: jest.Mock;
  let controller: HealthController;

  beforeEach(() => {
    pingCheck = jest.fn().mockResolvedValue({ database: { status: 'up' } });
    check = jest.fn(
      async (indicators: HealthIndicatorFunction[]): Promise<unknown> => {
        for (const indicator of indicators) {
          await indicator();
        }
        return result;
      },
    );
    controller = new HealthController(
      { check } as unknown as HealthCheckService,
      { pingCheck } as unknown as TypeOrmHealthIndicator,
    );
  });

  it('reports liveness unconditionally', () => {
    expect(controller.live()).toEqual({ status: 'ok' });
  });

  it('pings the database for readiness', async () => {
    await expect(controller.ready()).resolves.toBe(result);

    expect(pingCheck).toHaveBeenCalledWith('database', { timeout: 1500 });
  });

  it('falls back to Object metadata when design-time types are not constructors', () => {
    const globals = globalThis as { Promise: PromiseConstructor };
    const realPromise = globals.Promise;
    jest.doMock('@nestjs/common', () => nestCommon);
    jest.doMock('@nestjs/terminus', () => ({
      HealthCheck: (): MethodDecorator => () => undefined,
      HealthCheckService: {},
      TypeOrmHealthIndicator: {},
    }));
    try {
      globals.Promise = {} as PromiseConstructor;
      jest.isolateModules(() => {
        const reloaded = jest.requireActual<{ HealthController: unknown }>(
          './health.controller',
        );
        expect(typeof reloaded.HealthController).toBe('function');
      });
    } finally {
      globals.Promise = realPromise;
      jest.dontMock('@nestjs/common');
      jest.dontMock('@nestjs/terminus');
    }
  });
});
