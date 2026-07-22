import type { IncomingMessage } from 'node:http';
import { buildLoggerOptions } from './logging';
import { REQUEST_ID_HEADER } from './request-context.middleware';

interface BuiltPinoHttpOptions {
  name: string;
  level: string;
  genReqId: (req: IncomingMessage) => string;
  redact: string[];
  autoLogging: { ignore: (req: IncomingMessage) => boolean };
}

const build = (serviceName = 'test-service'): BuiltPinoHttpOptions =>
  buildLoggerOptions(serviceName).pinoHttp as unknown as BuiltPinoHttpOptions;

describe('buildLoggerOptions', () => {
  const savedLogLevel = process.env.LOG_LEVEL;
  const savedNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (savedLogLevel === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = savedLogLevel;
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
  });

  it('prefers an explicit LOG_LEVEL', () => {
    process.env.LOG_LEVEL = 'debug';

    expect(build().level).toBe('debug');
  });

  it('is silent under tests when LOG_LEVEL is unset', () => {
    delete process.env.LOG_LEVEL;
    process.env.NODE_ENV = 'test';

    expect(build().level).toBe('silent');
  });

  it('defaults to info outside tests', () => {
    delete process.env.LOG_LEVEL;
    process.env.NODE_ENV = 'production';

    expect(build().level).toBe('info');
  });

  it('tags lines with the service name and redacts credentials', () => {
    const options = build('audit-service');

    expect(options.name).toBe('audit-service');
    expect(options.redact).toEqual(['req.headers.authorization']);
  });

  it('reuses the request id minted by the context middleware', () => {
    const req = {
      headers: { [REQUEST_ID_HEADER]: 'req-9' },
    } as unknown as IncomingMessage;

    expect(build().genReqId(req)).toBe('req-9');
  });

  it('suppresses auto-logs for probes and scrapes only', () => {
    const { ignore } = build().autoLogging;

    expect(ignore({ url: '/health/ready' } as unknown as IncomingMessage)).toBe(
      true,
    );
    expect(ignore({ url: '/metrics' } as unknown as IncomingMessage)).toBe(
      true,
    );
    expect(ignore({ url: '/work-orders' } as unknown as IncomingMessage)).toBe(
      false,
    );
    expect(ignore({} as unknown as IncomingMessage)).toBe(false);
  });
});
