import * as nestCommon from '@nestjs/common';
import type { Response } from 'express';
import type { Registry } from 'prom-client';
import * as tokens from './metrics.tokens';
import { MetricsController } from './metrics.controller';

describe('MetricsController', () => {
  it('serves the registry snapshot with its content type', async () => {
    const registry = {
      contentType: 'text/plain; version=0.0.4; charset=utf-8',
      metrics: jest.fn().mockResolvedValue('# HELP up 1'),
    };
    const controller = new MetricsController(registry as unknown as Registry);
    const setHeader = jest.fn();
    const send = jest.fn();

    await controller.metrics({ setHeader, send } as unknown as Response);

    expect(setHeader).toHaveBeenCalledWith(
      'content-type',
      registry.contentType,
    );
    expect(send).toHaveBeenCalledWith('# HELP up 1');
  });

  it('falls back to Object metadata when Promise is not a constructor', () => {
    const globals = globalThis as { Promise: PromiseConstructor };
    const realPromise = globals.Promise;
    jest.doMock('@nestjs/common', () => nestCommon);
    jest.doMock('./metrics.tokens', () => tokens);
    try {
      globals.Promise = {} as PromiseConstructor;
      jest.isolateModules(() => {
        const reloaded = jest.requireActual<{ MetricsController: unknown }>(
          './metrics.controller',
        );
        expect(typeof reloaded.MetricsController).toBe('function');
      });
    } finally {
      globals.Promise = realPromise;
      jest.dontMock('@nestjs/common');
      jest.dontMock('./metrics.tokens');
    }
  });
});
