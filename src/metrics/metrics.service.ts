import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class MetricsService {
  constructor(private readonly httpService: HttpService) {}

  private readonly TARGET = 'http://localhost:3000/metrics';
private metricsStore: Record<string, any[]> = {};
private history: any[] = []; // full snapshots over time

  async fetchRawMetrics(): Promise<string> {
    const response = await lastValueFrom(
      this.httpService.get(this.TARGET),
    );
    return response.data;
  }

  parseMetrics(raw: string) {
    const lines = raw.split('\n');

    const result: Record<string, any[]> = {};

    for (const line of lines) {
      if (line.startsWith('#') || line.trim() === '') continue;

      const [metricWithLabels, value] = line.split(' ');

      const match = metricWithLabels.match(/^(\w+)(\{.*\})?/);
      if (!match) continue;

      const metricName = match[1];
      const labelsRaw = match[2];

      let labels: Record<string, string> = {};

      if (labelsRaw) {
        const labelPairs = labelsRaw
          .replace(/[{}]/g, '')
          .split(',');

        labels = Object.fromEntries(
          labelPairs.map(pair => {
            const [key, val] = pair.split('=');
            return [key, val.replace(/"/g, '')];
          }),
        );
      }

      if (!result[metricName]) {
        result[metricName] = [];
      }

      result[metricName].push({
        labels,
        value: Number(value),
      });
    }

    return result;
  }

  async getMetrics() {
    const raw = await this.fetchRawMetrics();
    return this.parseMetrics(raw);
  }

@Cron('*/15 * * * * *')
async pollMetrics() {
  const data = await this.getMetrics();

  // store latest snapshot
  this.metricsStore = data;

  // store history (time series)
  this.history.push({
    timestamp: new Date(),
    data,
  });

  // limit history size (avoid memory leak)
  if (this.history.length > 100) {
    this.history.shift();
  }
}

getDashboardMetrics() {
  const data = this.metricsStore;

  const getValue = (metric: string) =>
    data[metric]?.[0]?.value || 0;

  const memoryUsed = getValue('nodejs_heap_size_used_bytes');
  const memoryTotal = getValue('nodejs_heap_size_total_bytes');

  const memoryUsage =
    memoryTotal > 0 ? (memoryUsed / memoryTotal) * 100 : 0;

  const eventLoopLag =
    getValue('nodejs_eventloop_lag_p99_seconds') * 1000; // ms

  const totalRequests = (data['http_requests_total'] || [])
    .reduce((sum, m) => sum + m.value, 0);

  return {
    memory: {
      used: memoryUsed,
      total: memoryTotal,
      usagePercent: memoryUsage,
    },
    latency: {
      eventLoopLagMs: eventLoopLag,
    },
    requests: {
      total: totalRequests,
    },
  };
}
}