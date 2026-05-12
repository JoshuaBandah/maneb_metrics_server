import { Body, Controller, Get, Post } from '@nestjs/common';
import { K6MonitorService } from './k6-monitor.service';

@Controller('k6')
export class K6MonitorController {
  constructor(
    private readonly k6MonitorService: K6MonitorService,
  ) {}
  @Post('vu-result')
  ingestVuResult(@Body() body: any) {
    this.k6MonitorService.ingestResult(body);
    return { ok: true };
  }

  @Get('metrics')
  getMetrics() {
    return this.k6MonitorService.getMetrics();
  }

  
  @Post('clear')
  clear() {
    this.k6MonitorService.reset();

    return {
      ok: true,
      message:
        'K6 realtime metrics cleared',
    };
  }
}