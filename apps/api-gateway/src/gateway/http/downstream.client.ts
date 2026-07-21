import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
} from '@nestjs/common';

export const REQUEST_TIMEOUT_MS = 3_000;

/**
 * Thin wrapper around fetch encoding the gateway's downstream policy:
 *
 * - every call has a hard timeout (a slow dependency must not exhaust the
 *   gateway's own connections — fail fast and let the client retry);
 * - downstream HTTP errors pass through untouched (status + body), so
 *   validation messages and 404s reach the caller exactly as produced;
 * - transport failures are translated: timeout → 504, unreachable → 502.
 */
export class DownstreamClient {
  constructor(
    private readonly baseUrl: string,
    private readonly serviceName: string,
  ) {}

  protected get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  protected post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  protected patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new GatewayTimeoutException(
          `${this.serviceName} timed out after ${REQUEST_TIMEOUT_MS}ms`,
        );
      }
      throw new BadGatewayException(`${this.serviceName} is unreachable`);
    }

    const body: unknown =
      response.status === 204 ? undefined : await response.json();

    if (!response.ok) {
      throw new HttpException(body as Record<string, unknown>, response.status);
    }
    return body as T;
  }
}
