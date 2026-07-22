import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityFeedController } from './activity-feed.controller';
import { ActivityFeedService } from './activity-feed.service';
import { AuditEvent } from './audit-event.entity';
import { AuditIngestService } from './audit-ingest.service';
import { AuditStreamConsumer } from './audit-stream.consumer';

@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent])],
  controllers: [ActivityFeedController],
  providers: [AuditIngestService, AuditStreamConsumer, ActivityFeedService],
})
export class AuditModule {}
