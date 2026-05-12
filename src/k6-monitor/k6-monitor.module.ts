import { Module } from '@nestjs/common';
import { K6MonitorService } from './k6-monitor.service';
import { K6MonitorController } from './k6-monitor.controller';

@Module({
  controllers: [K6MonitorController],
  providers: [K6MonitorService],
  exports:[K6MonitorService]
})
export class K6MonitorModule {}
