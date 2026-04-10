import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';
import { Cron } from '@nestjs/schedule';
import * as os from 'os';

@Injectable()
export class MetricsService {
  constructor(private readonly httpService: HttpService) {}

  private readonly logger = new Logger(MetricsService.name);
  private readonly TARGET = 'http://localhost:3000/metrics';

  private metricsStore: Record<string, any[]> = {};
  private history: any[] = [];
  private currentDashboardMetrics: any = this.getDefaultMetrics();

  // Track cumulative values - THESE ARE THE SOURCE OF TRUTH
  private lastCpu = {
    total: 0,
    timestamp: Date.now(),
  };

  private lastRequestCounts = {
    total: 0,
    failed: 0,
  };

  private isFirstPoll = true;

  private getDefaultMetrics() {
    return {
      memory: { used: 0, total: 0, usagePercent: 0 },
      latency: { avgMs: 0, p50Ms: 0, p90Ms: 0, p99Ms: 0, eventLoopLagMs: 0 },
      requests: { total: 0, failed: 0, success: 0, errorRatePercent: 0 },
      cpu: { usagePercent: 0 },
    };
  }

  async fetchRawMetrics(): Promise<string> {
    try {
      const response = await lastValueFrom(
        this.httpService.get(this.TARGET, { timeout: 3000 }),
      );
      return response.data;
    } catch (err) {
      this.logger.error('Failed to scrape metrics', err);
      return '';
    }
  }

  private parseLabels(raw: string): Record<string, string> {
    const labels: Record<string, string> = {};
    const regex = /(\w+)\s*=\s*"([^"]*)"/g;

    let match;
    while ((match = regex.exec(raw))) {
      labels[match[1]] = match[2];
    }

    return labels;
  }

  parseMetrics(raw: string) {
    const lines = raw.split('\n');
    const result: Record<string, any[]> = {};

    for (const line of lines) {
      if (line.startsWith('#') || line.trim() === '') continue;

      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) continue;

      const metricWithLabels = parts[0];
      const value = Number(parts[1]);

      if (isNaN(value)) continue;

      const match = metricWithLabels.match(
        /^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{.*\})?/
      );

      if (!match) continue;

      const metricName = match[1];
      const labelsRaw = match[2];

      const labels = labelsRaw ? this.parseLabels(labelsRaw) : {};

      if (!result[metricName]) result[metricName] = [];

      result[metricName].push({
        labels,
        value,
      });
    }

    return result;
  }

  async getMetrics() {
    const raw = await this.fetchRawMetrics();
    if (!raw) return {};
    return this.parseMetrics(raw);
  }

  @Cron('*/5 * * * * *')
  async pollMetrics() {
    this.logger.debug('Polling metrics...');
    const data = await this.getMetrics();
    
    if (!data || Object.keys(data).length === 0) {
      this.logger.warn('No metrics data received');
      return;
    }

    this.metricsStore = data;
    
    // Calculate metrics (this updates the internal counters)
    const dashboardData = this.calculateDashboardMetrics();
    this.currentDashboardMetrics = dashboardData;

    this.history.push({
      timestamp: new Date(),
      ...dashboardData,
    });

    if (this.history.length > 60) {
      this.history.shift();
    }
    
    // Only log if there are actual requests
    if (dashboardData.requests.total > 0 || !this.isFirstPoll) {
      this.logger.log(`📊 Poll complete - Requests: ${dashboardData.requests.total}, CPU: ${dashboardData.cpu.usagePercent.toFixed(1)}%, Memory: ${dashboardData.memory.usagePercent.toFixed(1)}%`);
    }
    
    this.isFirstPoll = false;
  }

  private calculateDashboardMetrics() {
    const data = this.metricsStore;

    const getValue = (metric: string) => data[metric]?.[0]?.value || 0;
    const getMetrics = (metric: string) => data[metric] || [];

    // 📊 REQUESTS - Get current cumulative values from Prometheus
    const requests = getMetrics('http_requests_total');
    const failedMetrics = getMetrics('http_requests_failed_total');

    let currentTotal = 0;
    let currentFailed = 0;

    for (const m of requests) currentTotal += m.value;
    for (const m of failedMetrics) currentFailed += m.value;

    // Calculate delta since last poll
    let totalRequests = 0;
    let failedRequests = 0;

    if (!this.isFirstPoll && this.lastRequestCounts.total > 0) {
      totalRequests = Math.max(0, currentTotal - this.lastRequestCounts.total);
      failedRequests = Math.max(0, currentFailed - this.lastRequestCounts.failed);
    }

    // Update stored values for next poll
    this.lastRequestCounts = {
      total: currentTotal,
      failed: currentFailed,
    };

    const successRequests = totalRequests - failedRequests;
    const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;

    // ⏱️ LATENCY (AVG)
    const sum = getValue('http_request_duration_seconds_sum');
    const count = getValue('http_request_duration_seconds_count');
    const avgResponseTimeMs = count > 0 ? (sum / count) * 1000 : 0;

    // ⏱️ LATENCY (PERCENTILES)
    const buckets = getMetrics('http_request_duration_seconds_bucket');
    let p50 = 0, p90 = 0, p99 = 0;

    if (buckets.length > 0) {
      const sorted = buckets
        .map(b => ({
          le: parseFloat(b.labels.le),
          value: b.value,
        }))
        .filter(b => !isNaN(b.le))
        .sort((a, b) => a.le - b.le);

      const totalCount = sorted.at(-1)?.value || 0;

      const findPercentile = (p: number) => {
        const target = totalCount * p;
        for (const b of sorted) {
          if (b.value >= target) return b.le;
        }
        return 0;
      };

      if (totalCount > 0) {
        p50 = findPercentile(0.5) * 1000;
        p90 = findPercentile(0.9) * 1000;
        p99 = findPercentile(0.99) * 1000;
      }
    }

    // ⚡ EVENT LOOP
    const rawLag = getValue('nodejs_eventloop_lag_seconds');
    const eventLoopLag = rawLag * 1000 || 0;

    // 🧠 MEMORY
    const memoryUsed = getValue('nodejs_heap_size_used_bytes');
    const memoryTotal = getValue('nodejs_heap_size_total_bytes');
    const memoryUsage = memoryTotal > 0 ? (memoryUsed / memoryTotal) * 100 : 0;

    // 🔥 CPU
    const cpuTotal = getValue('process_cpu_seconds_total');
    const now = Date.now();

    let cpuUsage = 0;

    if (this.lastCpu.total > 0 && cpuTotal > this.lastCpu.total) {
      const cpuDelta = cpuTotal - this.lastCpu.total;
      const timeDelta = (now - this.lastCpu.timestamp) / 1000;

      if (cpuDelta >= 0 && timeDelta > 0) {
        const cpuCount = os.cpus().length;
        cpuUsage = Math.min(100, (cpuDelta / (timeDelta * cpuCount)) * 100);
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
        avgMs: avgResponseTimeMs,
        p50Ms: p50,
        p90Ms: p90,
        p99Ms: p99,
        eventLoopLagMs: eventLoopLag,
      },
      requests: {
        total: totalRequests,
        failed: failedRequests,
        success: successRequests,
        errorRatePercent: errorRate,
      },
      cpu: {
        usagePercent: cpuUsage,
      },
    };
  }

  // This method is for SSE - just returns the latest calculated metrics
  getDashboardMetrics() {
    return this.currentDashboardMetrics;
  }

  getHistory() {
    return this.history;
  }
  
  // Debug method to check current cumulative values
  getDebugInfo() {
    return {
      lastRequestCounts: this.lastRequestCounts,
      isFirstPoll: this.isFirstPoll,
      historyLength: this.history.length,
      currentMetrics: this.currentDashboardMetrics,
    };
  }
}















// // metrics.service.ts - Modified version
// import { HttpService } from '@nestjs/axios';
// import { Injectable, Logger } from '@nestjs/common';
// import { lastValueFrom } from 'rxjs';
// import * as os from 'os';

// @Injectable()
// export class MetricsService {
//   constructor(private readonly httpService: HttpService) {}

//   private readonly logger = new Logger(MetricsService.name);
//   private readonly TARGET = 'http://localhost:3000/metrics';

//   private metricsStore: Record<string, any[]> = {};
//   private history: any[] = [];
//   private currentDashboardMetrics: any = this.getDefaultMetrics();
//   private lastUpdateTime = 0;
//   private readonly UPDATE_INTERVAL = 2000; // Update every 2 seconds max

//   // Track cumulative values
//   private lastCpu = {
//     total: 0,
//     timestamp: Date.now(),
//   };

//   private lastRequestCounts = {
//     total: 0,
//     failed: 0,
//   };

//   private isFirstPoll = true;

//   private getDefaultMetrics() {
//     return {
//       memory: { used: 0, total: 0, usagePercent: 0 },
//       latency: { avgMs: 0, p50Ms: 0, p90Ms: 0, p99Ms: 0, eventLoopLagMs: 0 },
//       requests: { total: 0, failed: 0, success: 0, errorRatePercent: 0 },
//       cpu: { usagePercent: 0 },
//     };
//   }

//   async fetchRawMetrics(): Promise<string> {
//     try {
//       const response = await lastValueFrom(
//         this.httpService.get(this.TARGET, { timeout: 3000 }),
//       );
//       return response.data;
//     } catch (err) {
//       this.logger.error('Failed to scrape metrics', err);
//       return '';
//     }
//   }

//   private parseLabels(raw: string): Record<string, string> {
//     const labels: Record<string, string> = {};
//     const regex = /(\w+)\s*=\s*"([^"]*)"/g;

//     let match;
//     while ((match = regex.exec(raw))) {
//       labels[match[1]] = match[2];
//     }

//     return labels;
//   }

//   parseMetrics(raw: string) {
//     const lines = raw.split('\n');
//     const result: Record<string, any[]> = {};

//     for (const line of lines) {
//       if (line.startsWith('#') || line.trim() === '') continue;

//       const parts = line.trim().split(/\s+/);
//       if (parts.length < 2) continue;

//       const metricWithLabels = parts[0];
//       const value = Number(parts[1]);

//       if (isNaN(value)) continue;

//       const match = metricWithLabels.match(
//         /^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{.*\})?/
//       );

//       if (!match) continue;

//       const metricName = match[1];
//       const labelsRaw = match[2];

//       const labels = labelsRaw ? this.parseLabels(labelsRaw) : {};

//       if (!result[metricName]) result[metricName] = [];

//       result[metricName].push({
//         labels,
//         value,
//       });
//     }

//     return result;
//   }

//   async updateMetricsIfNeeded() {
//     const now = Date.now();
//     if (now - this.lastUpdateTime < this.UPDATE_INTERVAL) {
//       return; // Don't update too frequently
//     }

//     this.lastUpdateTime = now;
//     await this.pollMetrics();
//   }

//   async pollMetrics() {
//     const data = await this.getMetrics();
    
//     if (!data || Object.keys(data).length === 0) {
//       return;
//     }

//     this.metricsStore = data;
    
//     const dashboardData = this.calculateDashboardMetrics();
//     this.currentDashboardMetrics = dashboardData;

//     this.history.push({
//       timestamp: new Date(),
//       ...dashboardData,
//     });

//     if (this.history.length > 60) {
//       this.history.shift();
//     }
    
//     if (dashboardData.requests.total > 0 || !this.isFirstPoll) {
//       this.logger.debug(`Metrics updated - Requests: ${dashboardData.requests.total}`);
//     }
    
//     this.isFirstPoll = false;
//   }

//   async getMetrics() {
//     const raw = await this.fetchRawMetrics();
//     if (!raw) return {};
//     return this.parseMetrics(raw);
//   }

//   private calculateDashboardMetrics() {
//     const data = this.metricsStore;

//     const getValue = (metric: string) => data[metric]?.[0]?.value || 0;
//     const getMetrics = (metric: string) => data[metric] || [];

//     // Requests calculations
//     const requests = getMetrics('http_requests_total');
//     const failedMetrics = getMetrics('http_requests_failed_total');

//     let currentTotal = 0;
//     let currentFailed = 0;

//     for (const m of requests) currentTotal += m.value;
//     for (const m of failedMetrics) currentFailed += m.value;

//     let totalRequests = 0;
//     let failedRequests = 0;

//     if (!this.isFirstPoll && this.lastRequestCounts.total > 0) {
//       totalRequests = Math.max(0, currentTotal - this.lastRequestCounts.total);
//       failedRequests = Math.max(0, currentFailed - this.lastRequestCounts.failed);
//     }

//     this.lastRequestCounts = {
//       total: currentTotal,
//       failed: currentFailed,
//     };

//     const successRequests = totalRequests - failedRequests;
//     const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;

//     // Latency calculations
//     const sum = getValue('http_request_duration_seconds_sum');
//     const count = getValue('http_request_duration_seconds_count');
//     const avgResponseTimeMs = count > 0 ? (sum / count) * 1000 : 0;

//     const buckets = getMetrics('http_request_duration_seconds_bucket');
//     let p50 = 0, p90 = 0, p99 = 0;

//     if (buckets.length > 0) {
//       const sorted = buckets
//         .map(b => ({
//           le: parseFloat(b.labels.le),
//           value: b.value,
//         }))
//         .filter(b => !isNaN(b.le))
//         .sort((a, b) => a.le - b.le);

//       const totalCount = sorted.at(-1)?.value || 0;

//       const findPercentile = (p: number) => {
//         const target = totalCount * p;
//         for (const b of sorted) {
//           if (b.value >= target) return b.le;
//         }
//         return 0;
//       };

//       if (totalCount > 0) {
//         p50 = findPercentile(0.5) * 1000;
//         p90 = findPercentile(0.9) * 1000;
//         p99 = findPercentile(0.99) * 1000;
//       }
//     }

//     const rawLag = getValue('nodejs_eventloop_lag_seconds');
//     const eventLoopLag = rawLag * 1000 || 0;

//     // Memory calculations
//     const memoryUsed = getValue('nodejs_heap_size_used_bytes');
//     const memoryTotal = getValue('nodejs_heap_size_total_bytes');
//     const memoryUsage = memoryTotal > 0 ? (memoryUsed / memoryTotal) * 100 : 0;

//     // CPU calculations
//     const cpuTotal = getValue('process_cpu_seconds_total');
//     const now = Date.now();

//     let cpuUsage = 0;

//     if (this.lastCpu.total > 0 && cpuTotal > this.lastCpu.total) {
//       const cpuDelta = cpuTotal - this.lastCpu.total;
//       const timeDelta = (now - this.lastCpu.timestamp) / 1000;

//       if (cpuDelta >= 0 && timeDelta > 0) {
//         const cpuCount = os.cpus().length;
//         cpuUsage = Math.min(100, (cpuDelta / (timeDelta * cpuCount)) * 100);
//       }
//     }

//     this.lastCpu = {
//       total: cpuTotal,
//       timestamp: now,
//     };

//     return {
//       memory: {
//         used: memoryUsed,
//         total: memoryTotal,
//         usagePercent: memoryUsage,
//       },
//       latency: {
//         avgMs: avgResponseTimeMs,
//         p50Ms: p50,
//         p90Ms: p90,
//         p99Ms: p99,
//         eventLoopLagMs: eventLoopLag,
//       },
//       requests: {
//         total: totalRequests,
//         failed: failedRequests,
//         success: successRequests,
//         errorRatePercent: errorRate,
//       },
//       cpu: {
//         usagePercent: cpuUsage,
//       },
//     };
//   }

//   // For SSE - returns latest metrics and updates if needed
//   async getDashboardMetrics() {
//     await this.updateMetricsIfNeeded();
//     return this.currentDashboardMetrics;
//   }

//   getHistory() {
//     return this.history;
//   }
  
//   getDebugInfo() {
//     return {
//       lastRequestCounts: this.lastRequestCounts,
//       isFirstPoll: this.isFirstPoll,
//       historyLength: this.history.length,
//       currentMetrics: this.currentDashboardMetrics,
//     };
//   }
// }









