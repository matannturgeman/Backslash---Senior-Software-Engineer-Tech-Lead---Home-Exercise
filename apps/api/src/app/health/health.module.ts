import { Module } from '@nestjs/common';
import { HealthModule as HealthLibModule } from '@libs/server-health';
import { HealthController } from './health.controller.js';

@Module({
  imports: [HealthLibModule],
  controllers: [HealthController],
})
export class HealthModule {}
