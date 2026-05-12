import { Test, TestingModule } from '@nestjs/testing';
import { K6MonitorController } from './k6-monitor.controller';
import { K6MonitorService } from './k6-monitor.service';

describe('K6MonitorController', () => {
  let controller: K6MonitorController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [K6MonitorController],
      providers: [K6MonitorService],
    }).compile();

    controller = module.get<K6MonitorController>(K6MonitorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
