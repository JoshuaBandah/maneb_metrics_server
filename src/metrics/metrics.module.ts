import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [HttpModule,ScheduleModule.forRoot(),],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}