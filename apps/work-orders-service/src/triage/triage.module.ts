import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagingModule } from '../messaging/messaging.module';
import { WorkOrder } from '../work-orders/work-order.entity';
import { AnthropicTriageClassifier } from './anthropic-triage.classifier';
import { TriageClassifier } from './triage-classifier';
import { TriageService } from './triage.service';
import { WorkOrderTriageConsumer } from './work-order-triage.consumer';

@Module({
  imports: [TypeOrmModule.forFeature([WorkOrder]), MessagingModule],
  providers: [
    { provide: TriageClassifier, useClass: AnthropicTriageClassifier },
    TriageService,
    WorkOrderTriageConsumer,
  ],
})
export class TriageModule {}
