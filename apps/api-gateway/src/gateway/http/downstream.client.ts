import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
} from '@nestjs/common';
import {
  currentRequestId,
  currentUserId,
  REQUEST_ID_HEADER,
  USER_ID_HEADER,
} from '@app/observability';

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
    const requestId = currentRequestId();
    // Identity crosses the sync boundary the same way the correlation id
    // does; services trust the header because only the gateway can reach
    // them (k8s NetworkPolicy).
    const userId = currentUserId();
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          'content-type': 'application/json',
          // Propagate the caller's correlation id so one user action is
          // traceable across every service it touches.
          ...(requestId ? { [REQUEST_ID_HEADER]: requestId } : {}),
          ...(userId ? { [USER_ID_HEADER]: userId } : {}),
        },
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
