import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

@Injectable()
export class MonitorCheckerService {
  private readonly logger = new Logger(MonitorCheckerService.name);

  @Interval(10000)
  checkMonitors() {
    this.logger.log('Monitor check worker is running');
  }
}
