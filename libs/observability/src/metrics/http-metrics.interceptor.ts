import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import type { Histogram } from 'prom-client';
import { HTTP_DURATION_HISTOGRAM } from './metrics.tokens';

interface RequestLike {
  method: string;
  route?: { path?: string };
}

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(
    @Inject(HTTP_DURATION_HISTOGRAM)
    private readonly histogram: Histogram<'method' | 'route' | 'status_code'>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const startedAt = process.hrtime.bigint();
    const request = context.switchToHttp().getRequest<RequestLike>();

    const record = (statusCode: number): void => {
      const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
      this.histogram.observe(
        {
          method: request.method,
          // The route TEMPLATE (/work-orders/:id), never the raw URL: one
          // label value per endpoint keeps metric cardinality bounded.
          route: request.route?.path ?? 'unmatched',
          status_code: String(statusCode),
        },
        seconds,
      );
    };

    return next.handle().pipe(
      tap(() =>
        record(
          context.switchToHttp().getResponse<{ statusCode: number }>()
            .statusCode,
        ),
      ),
      catchError((error: unknown) => {
        record(error instanceof HttpException ? error.getStatus() : 500);
        return throwError(() => error);
      }),
    );
  }
}
