import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicatorResult } from '@nestjs/terminus';

const PROBE_TIMEOUT_MS = 1_000;

@Injectable()
export class DownstreamHealthIndicator {
  async check(key: string, baseUrl: string): Promise<HealthIndicatorResult> {
    try {
      const response = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`responded ${response.status}`);
      }
      return { [key]: { status: 'up' } };
    } catch (error) {
      throw new HealthCheckError(`${key} is unreachable`, {
        [key]: {
          status: 'down',
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
}
