import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MetricsModule } from './metrics/metrics.module';
import { UserModule } from './user/user.module';
import { AuthenticationModule } from './authentication/authentication.module';
import { K6MonitorModule } from './k6-monitor/k6-monitor.module';

@Module({
  imports: [MetricsModule, UserModule, AuthenticationModule, K6MonitorModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
