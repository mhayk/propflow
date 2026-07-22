import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { requestContextMiddleware } from '@app/observability';

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

  // OpenAPI docs, generated from the controllers so they cannot drift.
  // The gateway is the public surface, so it is the only app that publishes
  // them; docs/api.md is the GitHub-readable companion.
  const openApiConfig = new DocumentBuilder()
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
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, openApiConfig),
  );
}
