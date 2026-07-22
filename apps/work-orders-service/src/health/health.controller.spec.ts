import { Test, TestingModule } from '@nestjs/testing';
import {
  HealthCheckResult,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let health: { check: jest.Mock };
  let db: { pingCheck: jest.Mock };

  const checkResult: HealthCheckResult = {
    status: 'ok',
    info: { database: { status: 'up' } },
    error: {},
    details: { database: { status: 'up' } },
  };

  beforeEach(async () => {
    db = {
      pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }),
    };
    // Runs every indicator like terminus would, so the ping arrow executes.
    health = {
      check: jest
        .fn()
        .mockImplementation(
          async (indicators: Array<() => Promise<unknown>>) => {
            await Promise.all(indicators.map((run) => run()));
            return checkResult;
          },
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: health },
        { provide: TypeOrmHealthIndicator, useValue: db },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('reports liveness without touching any dependency', () => {
    expect(controller.live()).toEqual({ status: 'ok' });
    expect(health.check).not.toHaveBeenCalled();
    expect(db.pingCheck).not.toHaveBeenCalled();
  });

  it('reports readiness by pinging the database through terminus', async () => {
    await expect(controller.ready()).resolves.toBe(checkResult);

    expect(health.check).toHaveBeenCalledTimes(1);
    expect(db.pingCheck).toHaveBeenCalledWith('database', { timeout: 1500 });
  });

  // ts-jest transpiles file-by-file, so `emitDecoratorMetadata` guards every
  // imported/global design type with `typeof X === 'function' ? X : Object`;
  // loading the module without those values executes the fallback sides.
  describe('decorator metadata (ts-jest emit)', () => {
    it('falls back to Object metadata when dependencies and Promise are not loadable', () => {
      jest.isolateModules(() => {
        jest.doMock('@nestjs/common', () => ({
          Controller: () => () => undefined,
          Get: () => () => undefined,
        }));
        jest.doMock('@nestjs/terminus', () => ({
          HealthCheck: () => () => undefined,
        }));

        const globalRef = globalThis as { Promise?: PromiseConstructor };
        const realPromise = globalRef.Promise;
        globalRef.Promise = undefined;
        try {
          const mod = jest.requireActual<typeof import('./health.controller')>(
            './health.controller',
          );
          const paramTypes: unknown = Reflect.getMetadata(
            'design:paramtypes',
            mod.HealthController,
          );
          const readyReturnType: unknown = Reflect.getMetadata(
            'design:returntype',
            mod.HealthController.prototype,
            'ready',
          );

          expect(paramTypes).toEqual([Object, Object]);
          expect(readyReturnType).toBe(Object);
        } finally {
          globalRef.Promise = realPromise;
        }
      });
      jest.dontMock('@nestjs/common');
      jest.dontMock('@nestjs/terminus');
    });
  });
});
