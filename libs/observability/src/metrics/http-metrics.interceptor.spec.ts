import {
  CallHandler,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';

describe('HttpMetricsInterceptor', () => {
  let histogram: { observe: jest.Mock };
  let interceptor: HttpMetricsInterceptor;

  const httpContext = (statusCode: number): ExecutionContext =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          route: { path: '/work-orders/:id' },
        }),
        getResponse: () => ({ statusCode }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    histogram = { observe: jest.fn() };
    interceptor = new HttpMetricsInterceptor(histogram as never);
  });

  it('records the route template and status on success', async () => {
    const next: CallHandler = { handle: () => of('ok') };

    await firstValueFrom(interceptor.intercept(httpContext(200), next));

    expect(histogram.observe).toHaveBeenCalledWith(
      { method: 'GET', route: '/work-orders/:id', status_code: '200' },
      expect.any(Number),
    );
  });

  it('records the exception status on failure and rethrows', async () => {
    const next: CallHandler = {
      handle: () => throwError(() => new NotFoundException()),
    };

    await expect(
      firstValueFrom(interceptor.intercept(httpContext(200), next)),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(histogram.observe).toHaveBeenCalledWith(
      expect.objectContaining({ status_code: '404' }),
      expect.any(Number),
    );
  });

  it('labels non-http exceptions as 500 and rethrows', async () => {
    const next: CallHandler = {
      handle: () => throwError(() => new Error('boom')),
    };

    await expect(
      firstValueFrom(interceptor.intercept(httpContext(200), next)),
    ).rejects.toThrow('boom');

    expect(histogram.observe).toHaveBeenCalledWith(
      expect.objectContaining({ status_code: '500' }),
      expect.any(Number),
    );
  });

  it('labels requests without a matched route as unmatched', async () => {
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET' }),
        getResponse: () => ({ statusCode: 404 }),
      }),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of('ok') };

    await firstValueFrom(interceptor.intercept(context, next));

    expect(histogram.observe).toHaveBeenCalledWith(
      expect.objectContaining({ route: 'unmatched' }),
      expect.any(Number),
    );
  });

  it('passes non-http executions through without recording', async () => {
    const context = { getType: () => 'rpc' } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of('ok') };

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).resolves.toBe('ok');

    expect(histogram.observe).not.toHaveBeenCalled();
  });
});
