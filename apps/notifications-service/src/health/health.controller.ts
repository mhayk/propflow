import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
} from '@nestjs/terminus';
import { RabbitMQHealthIndicator } from './rabbitmq.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly rabbit: RabbitMQHealthIndicator,
  ) {}

  /** Liveness: the process is up and serving. Restart me if this fails. */
  @Get()
  live(): { status: string } {
    return { status: 'ok' };
  }

  /** Readiness: dependencies are reachable. Route traffic elsewhere if not. */
  @Get('ready')
  @HealthCheck()
  ready(): Promise<HealthCheckResult> {
    return this.health.check([() => this.rabbit.check('rabbitmq')]);
  }
}
