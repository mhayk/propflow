import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { Registry } from 'prom-client';
import { METRICS_REGISTRY } from './metrics.tokens';

@Controller('metrics')
export class MetricsController {
  constructor(@Inject(METRICS_REGISTRY) private readonly registry: Registry) {}

  @Get()
  async metrics(@Res() res: Response): Promise<void> {
    res.setHeader('content-type', this.registry.contentType);
    res.send(await this.registry.metrics());
  }
}
