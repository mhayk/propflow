import { INestApplication, ValidationPipe } from '@nestjs/common';

// Shared by main.ts and the e2e suite so tests exercise the exact production pipeline.
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
