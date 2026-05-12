import { Test, TestingModule } from '@nestjs/testing';
import { K6MonitorService } from './k6-monitor.service';

describe('K6MonitorService', () => {
  let service: K6MonitorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [K6MonitorService],
    }).compile();

    service = module.get<K6MonitorService>(K6MonitorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
