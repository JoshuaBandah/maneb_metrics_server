import { Injectable } from '@nestjs/common';

@Injectable()
export class K6MonitorService {
  private metrics = {
    total_requests: 0,
    failed_requests: 0,
    completed_requests: 0,
    queued_requests: 0,
  };

  // Add incremental updates from k6
  update(data: any) {
    this.metrics.total_requests +=
      data.add_total_requests || 0;

    this.metrics.failed_requests +=
      data.add_failed_requests || 0;

    this.metrics.completed_requests +=
      data.add_completed_requests || 0;

    this.metrics.queued_requests +=
      data.add_queued_requests || 0;


    console.table(this.metrics);
  }

  // Get current state
  getMetrics() {
    return this.metrics;
  }

  // Optional: reset
  reset() {
    this.metrics = {
      total_requests: 0,
      failed_requests: 0,
      completed_requests: 0,
      queued_requests: 0,
    };
  }
}