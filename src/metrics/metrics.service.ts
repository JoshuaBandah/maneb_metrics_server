import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class MetricsService {
  constructor(private readonly httpService: HttpService) { }

  private readonly TARGET = 'http://localhost:3000/metrics';

  private metricsStore: Record<string, any[]> = {};
  private history: any[] = [];


  private lastCpu = {
    total: 0,
    timestamp: Date.now(),
  };

  // FETCH
  async fetchRawMetrics(): Promise<string> {
    const response = await lastValueFrom(
      this.httpService.get(this.TARGET),
    );
    return response.data;
  }

  // PARSE
  parseMetrics(raw: string) {
    const lines = raw.split('\n');
    const result: Record<string, any[]> = {};

    for (const line of lines) {
      if (line.startsWith('#') || line.trim() === '') continue;


      const parts = line.trim().split(/\s+/);
      const metricWithLabels = parts[0];
      const value = parts[1];

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

  // GET
  async getMetrics() {
    const raw = await this.fetchRawMetrics();
    return this.parseMetrics(raw);
  }

  // POLL
  @Cron('*/5 * * * * *')
  async pollMetrics() {
    const data = await this.getMetrics();

    this.metricsStore = data;

    this.history.push({
      timestamp: new Date(),
      data,
    });

    if (this.history.length > 100) {
      this.history.shift();
    }
  }


  getDashboardMetrics() {
    const data = this.metricsStore;

    const getValue = (metric: string) =>
      data[metric]?.[0]?.value || 0;

    // REQUESTS
    const requests = data['http_requests_total'] || [];
    let totalRequests = 0;
    let failedRequests = 0;

    for (const m of requests) {
      totalRequests += m.value;
      const status = Number(m.labels.status);
      if (status >= 400) failedRequests += m.value;
    }

    const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;

    // MEMORY
    const memoryUsed = getValue('nodejs_heap_size_used_bytes');
    const memoryTotal = getValue('nodejs_heap_size_total_bytes');
    const memoryUsage = memoryTotal > 0 ? (memoryUsed / memoryTotal) * 100 : 0;

    // LATENCY
    const eventLoopLag = getValue('nodejs_eventloop_lag_p99_seconds') * 1000;

    // CPU
    const cpuTotal = getValue('process_cpu_seconds_total');
    const now = Date.now();
    let cpuUsage = 0;

    if (this.lastCpu && this.lastCpu.total > 0) {
      const cpuDelta = cpuTotal - this.lastCpu.total;
      const timeDelta = (now - this.lastCpu.timestamp) / 1000;
      if (cpuDelta >= 0 && timeDelta > 0) {
        cpuUsage = (cpuDelta / timeDelta) * 100;
      }
    }

    this.lastCpu = {
      total: cpuTotal,
      timestamp: now,
    };

    return {
      memory: {
        used: memoryUsed,
        total: memoryTotal,
        usagePercent: memoryUsage,
      },
      latency: {
        eventLoopLagMs: eventLoopLag,
        // avgResponseTimeMs: //<add when histogram available>
      },
      requests: {
        total: totalRequests,
        failed: failedRequests,
        errorRatePercent: errorRate,
      },
      cpu: {
        usagePercent: cpuUsage,
      },
    };
  }
}