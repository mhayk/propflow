// Exports the gateway's OpenAPI document to openapi.json without serving
// anything: the gateway has no broker or database dependency, so the app can
// be instantiated offline (CI does exactly this to publish the document on
// the docs site). Run via: npm run openapi:export
import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../apps/api-gateway/src/app.module';
import { buildOpenApiDocument } from '../apps/api-gateway/src/app.setup';

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = buildOpenApiDocument(app);
  writeFileSync('openapi.json', JSON.stringify(document, null, 2));
  await app.close();
  console.log('openapi.json written');
}

void main();
