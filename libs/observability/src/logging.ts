import type { IncomingMessage } from 'node:http';
import type { Params } from 'nestjs-pino';
import { REQUEST_ID_HEADER } from './request-context.middleware';

/**
 * One JSON log line per request, tagged with the service name and the
 * request id minted by requestContextMiddleware. Silent under tests;
 * pipe through `pino-pretty` for local reading.
 */
export function buildLoggerOptions(serviceName: string): Params {
  return {
    pinoHttp: {
      name: serviceName,
      level:
        process.env.LOG_LEVEL ??
        (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
      genReqId: (req: IncomingMessage) =>
        req.headers[REQUEST_ID_HEADER] as string,
      redact: ['req.headers.authorization'],
      autoLogging: {
        // Probes and scrapes would drown real traffic in the logs.
        ignore: (req: IncomingMessage) =>
          (req.url ?? '').includes('/health') ||
          (req.url ?? '').includes('/metrics'),
      },
    },
  };
}
