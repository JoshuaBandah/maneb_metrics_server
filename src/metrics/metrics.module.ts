import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { K6MonitorModule } from '../k6-monitor/k6-monitor.module';

@Module({
  imports: [HttpModule,
    ScheduleModule.forRoot(),
    K6MonitorModule
  ],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}