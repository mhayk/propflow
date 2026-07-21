import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { requestContextMiddleware } from '@app/observability';

// Shared by main.ts and the e2e suite so tests exercise the exact production pipeline.
export function configureApp(app: INestApplication): void {
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
}
