import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
} from '@nestjs/terminus';
import { Public } from '../auth/auth.decorators';
import { DownstreamHealthIndicator } from './downstream.health';

// Probes are called by the platform, not by users — no token to present.
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly downstream: DownstreamHealthIndicator,
  ) {}

  /** Liveness: the process is up and serving. Restart me if this fails. */
  @Get()
  live(): { status: string } {
    return { status: 'ok' };
  }

  /** Readiness: the gateway is only useful if its downstreams respond. */
  @Get('ready')
  @HealthCheck()
  ready(): Promise<HealthCheckResult> {
    return this.health.check([
      () =>
        this.downstream.check(
          'work-orders',
          process.env.WORK_ORDERS_URL ?? 'http://localhost:3001',
        ),
      () =>
        this.downstream.check(
          'properties',
          process.env.PROPERTIES_URL ?? 'http://localhost:3003',
        ),
    ]);
  }
}
