import {
  HealthCheckResult,
  HealthCheckService,
  HealthIndicatorFunction,
} from '@nestjs/terminus';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const originalWorkOrdersUrl = process.env.WORK_ORDERS_URL;
  const originalPropertiesUrl = process.env.PROPERTIES_URL;

  let controller: HealthController;
  let health: { check: jest.Mock };
  let downstream: { check: jest.Mock };

  const checkResult = {
    status: 'ok',
    info: {},
    error: {},
    details: {},
  } as HealthCheckResult;

  beforeEach(() => {
    delete process.env.WORK_ORDERS_URL;
    delete process.env.PROPERTIES_URL;

    health = {
      check: jest.fn(
        async (indicators: HealthIndicatorFunction[]): Promise<unknown> => {
          for (const indicator of indicators) {
            await indicator();
          }
          return checkResult;
        },
      ),
    };
    downstream = { check: jest.fn().mockResolvedValue({}) };

    controller = new HealthController(
      health as unknown as HealthCheckService,
      downstream,
    );
  });

  afterEach(() => {
    if (originalWorkOrdersUrl === undefined) {
      delete process.env.WORK_ORDERS_URL;
    } else {
      process.env.WORK_ORDERS_URL = originalWorkOrdersUrl;
    }
    if (originalPropertiesUrl === undefined) {
      delete process.env.PROPERTIES_URL;
    } else {
      process.env.PROPERTIES_URL = originalPropertiesUrl;
    }
  });

  it('reports liveness unconditionally', () => {
    expect(controller.live()).toEqual({ status: 'ok' });
  });

  it('probes the default downstream urls for readiness', async () => {
    await expect(controller.ready()).resolves.toBe(checkResult);

    expect(downstream.check).toHaveBeenCalledWith(
      'work-orders',
      'http://localhost:3001',
    );
    expect(downstream.check).toHaveBeenCalledWith(
      'properties',
      'http://localhost:3003',
    );
  });

  it('probes the configured downstream urls for readiness', async () => {
    process.env.WORK_ORDERS_URL = 'http://work-orders:4444';
    process.env.PROPERTIES_URL = 'http://properties:5555';

    await expect(controller.ready()).resolves.toBe(checkResult);

    expect(downstream.check).toHaveBeenCalledWith(
      'work-orders',
      'http://work-orders:4444',
    );
    expect(downstream.check).toHaveBeenCalledWith(
      'properties',
      'http://properties:5555',
    );
  });

  // The emitted design-time metadata guards every referenced type with
  // `typeof X !== "undefined" ? X : Object`; re-evaluating the module with
  // those identifiers absent walks the fallback arms of that emit.
  it('degrades design-time metadata to Object when types are not runtime values', () => {
    const globalRef = globalThis as { Promise?: PromiseConstructor };
    const originalPromise = globalRef.Promise;
    const decoratorFactory = () => (): void => undefined;

    jest.doMock('@nestjs/common', () => ({
      Controller: decoratorFactory,
      Get: decoratorFactory,
    }));
    jest.doMock('@nestjs/terminus', () => ({
      HealthCheck: decoratorFactory,
    }));
    jest.doMock('../auth/auth.decorators', () => ({
      Public: decoratorFactory,
    }));
    jest.doMock('./downstream.health', () => ({}));

    jest.isolateModules(() => {
      delete globalRef.Promise;
      try {
        const isolated = jest.requireActual<
          typeof import('./health.controller')
        >('./health.controller');
        expect(isolated.HealthController).toBeDefined();
      } finally {
        globalRef.Promise = originalPromise;
      }
    });

    jest.dontMock('@nestjs/common');
    jest.dontMock('@nestjs/terminus');
    jest.dontMock('../auth/auth.decorators');
    jest.dontMock('./downstream.health');
  });
});
