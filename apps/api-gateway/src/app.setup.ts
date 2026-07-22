import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import type { Express, Request, Response } from 'express';
import { Logger } from 'nestjs-pino';
import { requestContextMiddleware } from '@app/observability';

/**
 * The OpenAPI document, generated from the controllers so it cannot drift.
 * Shared by the runtime UI below and by scripts/export-openapi.ts, which
 * publishes it (rendered) on the docs site.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('PropFlow API')
    .setDescription(
      'Public API of the PropFlow platform, served by the gateway. ' +
        'Authenticate via POST /api/auth/login, then use the Authorize ' +
        'button with the returned accessToken. Sequence diagrams for every ' +
        'flow: docs/flows.md in the repository.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}

/**
 * Scalar's standalone bundle renders the reference entirely client-side, so
 * the "integration" is one HTML page pointing at the document — the exact
 * same page docs/api-reference/index.html uses on the docs site (there it
 * reads a statically exported openapi.json; here, the live /api/docs-json).
 */
const SCALAR_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PropFlow API</title>
  </head>
  <body>
    <script id="api-reference" data-url="/api/docs-json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.63.0"></script>
  </body>
</html>
`;

// Shared by main.ts and the e2e suite so tests exercise the exact production pipeline.
export function configureApp(app: INestApplication): void {
  // K8s stops pods with SIGTERM; the hooks run Nest's lifecycle so consumers,
  // the outbox relay and broker connections close before the process exits.
  app.enableShutdownHooks();
  app.use(requestContextMiddleware);
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Interactive reference (Scalar) + the raw document for tooling. Both are
  // public by nature — the docs explain how to authenticate, so they cannot
  // require it. These express routes sit outside the guard chain.
  const document = buildOpenApiDocument(app);
  const express = app.getHttpAdapter().getInstance() as Express;
  express.get('/api/docs', (_req: Request, res: Response) => {
    res.type('html').send(SCALAR_PAGE);
  });
  express.get('/api/docs-json', (_req: Request, res: Response) => {
    res.json(document);
  });
}
