import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { SafeHttpCheckerService } from '../safe-http-checker.service';

@Injectable()
export class MonitorCheckerService {
  private readonly logger = new Logger(MonitorCheckerService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly checker: SafeHttpCheckerService,
  ) {}

  @Interval(10000)
  async checkMonitors() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const monitors = await this.prisma.monitor.findMany({
        where: { enabled: true },
        select: { id: true, name: true, url: true, method: true },
      });

      for (let i = 0; i < monitors.length; i += 10) {
        await Promise.all(monitors.slice(i, i + 10).map(async (monitor) => {
          const result = await this.checker.check(monitor.url, monitor.method);

          await this.prisma.monitor.update({
            where: { id: monitor.id },
            data: { status: result.status },
          });

          this.logger.log(`${monitor.name}: ${result.status}`);
        }));
      }
    } catch (error) {
      this.logger.error('Monitor check cycle failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.isRunning = false;
    }
  }
}