import { HealthCheckError } from '@nestjs/terminus';
import { DownstreamHealthIndicator } from './downstream.health';

describe('DownstreamHealthIndicator', () => {
  let indicator: DownstreamHealthIndicator;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    indicator = new DownstreamHealthIndicator();
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  it('reports up when the downstream health endpoint responds', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await expect(
      indicator.check('work-orders', 'http://downstream:3001'),
    ).resolves.toEqual({ 'work-orders': { status: 'up' } });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://downstream:3001/health',
      expect.objectContaining({
        signal: expect.any(AbortSignal) as AbortSignal,
      }),
    );
  });

  it('reports down with the status when the downstream responds unhealthy', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });

    const failure = indicator.check('properties', 'http://downstream:3003');
    await expect(failure).rejects.toBeInstanceOf(HealthCheckError);
    await failure.catch((error: HealthCheckError) => {
      expect(error.message).toBe('properties is unreachable');
      expect(error.causes).toEqual({
        properties: { status: 'down', message: 'responded 503' },
      });
    });
  });

  it('reports down when the probe itself fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const failure = indicator.check('work-orders', 'http://downstream:3001');
    await expect(failure).rejects.toBeInstanceOf(HealthCheckError);
    await failure.catch((error: HealthCheckError) => {
      expect(error.causes).toEqual({
        'work-orders': { status: 'down', message: 'fetch failed' },
      });
    });
  });

  it('stringifies non-Error probe failures', async () => {
    fetchMock.mockRejectedValue('socket closed');

    const failure = indicator.check('work-orders', 'http://downstream:3001');
    await expect(failure).rejects.toBeInstanceOf(HealthCheckError);
    await failure.catch((error: HealthCheckError) => {
      expect(error.causes).toEqual({
        'work-orders': { status: 'down', message: 'socket closed' },
      });
    });
  });
});
