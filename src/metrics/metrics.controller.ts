import { Controller, Get, Sse } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { interval, Observable, switchMap } from 'rxjs';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) { }

  @Sse('stream')
  streamMetrics(): Observable<MessageEvent> {
    return interval(5000).pipe(
      switchMap(async () => {
        const data = this.metricsService.getDashboardMetrics();
        return new MessageEvent('metrics', {
          data: JSON.stringify(data)
        });
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