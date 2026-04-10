import { Controller, Get, Sse, MessageEvent } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { interval, map, Observable } from 'rxjs';
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) { }

  @Sse('stream')
  streamMetrics(): Observable<MessageEvent> {
    return interval(1000).pipe(
      map((): MessageEvent => {
        const data = this.metricsService.getDashboardMetrics();
        console.log(data)
        return {
          data,
        };
      }),
    );
  }
  // raw parsed metrics
  @Get('raw')
  getRaw() {
    return this.metricsService.getMetrics();
  }

  // dashboard-friendly data
  @Get('dashboard')
  getDashboard() {
    return this.metricsService.getDashboardMetrics();
  }

  // time-series history
  @Get('history')
  getHistory() {
    return this.metricsService['history'];
  }
}