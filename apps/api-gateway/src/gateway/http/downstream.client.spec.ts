import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
} from '@nestjs/common';
import { DownstreamClient } from './downstream.client';

class TestClient extends DownstreamClient {
  constructor() {
    super('http://downstream:1234', 'test service');
  }

  fetchThing(): Promise<{ ok: boolean }> {
    return this.get('/thing');
  }

  createThing(body: unknown): Promise<{ id: string }> {
    return this.post('/thing', body);
  }
}

describe('DownstreamClient', () => {
  let client: TestClient;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    client = new TestClient();
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  const jsonResponse = (status: number, body: unknown): Response =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }) as unknown as Response;

  it('returns the parsed body on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    await expect(client.fetchThing()).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://downstream:1234/thing',
      expect.objectContaining({
        signal: expect.any(AbortSignal) as AbortSignal,
      }),
    );
  });

  it('passes downstream errors through with their status and body', async () => {
    const errorBody = { statusCode: 409, message: 'invalid transition' };
    fetchMock.mockResolvedValue(jsonResponse(409, errorBody));

    const failure = client.createThing({});
    await expect(failure).rejects.toBeInstanceOf(HttpException);
    await failure.catch((error: HttpException) => {
      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toEqual(errorBody);
    });
  });

  it('maps a timeout to 504 Gateway Timeout', async () => {
    fetchMock.mockRejectedValue(new DOMException('timed out', 'TimeoutError'));

    await expect(client.fetchThing()).rejects.toBeInstanceOf(
      GatewayTimeoutException,
    );
  });

  it('maps an unreachable service to 502 Bad Gateway', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(client.fetchThing()).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
