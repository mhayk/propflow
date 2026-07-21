import { NestFactory } from '@nestjs/core';
import { WorkOrdersServiceModule } from './work-orders-service.module';

async function bootstrap() {
  const app = await NestFactory.create(WorkOrdersServiceModule);
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
