import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface VuResult {
  vu: number;
  success: boolean;
  waitTime?: number;
  stage?: string;
  reason?: string;
  timestamp: number;
}

@Injectable()
export class K6MonitorService {
  private vuMap = new Map<number, VuResult>();
  private log: VuResult[] = [];

  private stream$ = new Subject<VuResult>();

  get stream() {
    return this.stream$.asObservable();
  }

  ingestResult(data: VuResult) {
    const event: VuResult = {
      ...data,
      timestamp: Date.now(),
    };
    console.table(data)

    // latest state per VU
    this.vuMap.set(data.vu, event);

    // bounded log
    this.log.push(event);
    if (this.log.length > 10000) this.log.shift();

    this.stream$.next(event);
  }

  getMetrics() {
    const values = Array.from(this.vuMap.values());

    const total = values.length;
    const success = values.filter(v => v.success).length;
    const failed = total - success;

    return {
      total_vus: total,
      success_vus: success,
      failed_vus: failed,
      success_rate: total ? (success / total) * 100 : 0,
    };
  }

  getDebug() {
    return {
      last_events: this.log.slice(-10),
      unique_vus: this.vuMap.size,
    };
  }

  reset() {
    this.vuMap.clear();
    this.log = [];
  }
}