import { Body, Controller, Get, Post } from '@nestjs/common';
import { K6MonitorService } from './k6-monitor.service';


@Controller('k6')
export class K6MonitorController {
  constructor(
    private readonly metricsService: K6MonitorService,
  ) {}

  // Receive live updates from k6
  @Post('live')
  live(@Body() body: any) {
    this.metricsService.update(body);

    return { ok: true };
  }

  // View current global metrics
  @Get('live')
  getLive() {
    return this.metricsService.getMetrics();
  }
}