import { Module } from '@nestjs/common';

import { MonitorsController } from './monitors.controller';
import { MonitorsService } from './monitors.service';
import { MonitorCheckerService } from './monitor-checker/monitor-checker.service';
import { SafeHttpCheckerService } from './safe-http-checker.service';

@Module({
  controllers: [MonitorsController],
  providers: [MonitorsService, MonitorCheckerService, SafeHttpCheckerService],
})
export class MonitorsModule {}
