import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { DownstreamHealthIndicator } from './downstream.health';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [DownstreamHealthIndicator],
})
export class HealthModule {}
