import { DynamicModule, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { collectDefaultMetrics, Histogram, Registry } from 'prom-client';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { MetricsController } from './metrics.controller';
import { HTTP_DURATION_HISTOGRAM, METRICS_REGISTRY } from './metrics.tokens';

@Module({})
export class MetricsModule {
  static forRoot(serviceName: string): DynamicModule {
    // A registry per app instead of prom-client's global one: several apps
    // share one process in the full-stack tests, and duplicate metric
    // registration on a shared registry throws.
    const registry = new Registry();
    registry.setDefaultLabels({ service: serviceName });
    collectDefaultMetrics({ register: registry });

    const histogram = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration by method, route template and status code',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [registry],
    });

    return {
      module: MetricsModule,
      controllers: [MetricsController],
      providers: [
        { provide: METRICS_REGISTRY, useValue: registry },
        { provide: HTTP_DURATION_HISTOGRAM, useValue: histogram },
        { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
      ],
    };
  }
}
