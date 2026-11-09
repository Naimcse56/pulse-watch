import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MonitorCheckerService {
  private readonly logger = new Logger(MonitorCheckerService.name);
  private isRunning = false;

  constructor(private readonly prisma: PrismaService) {}

  @Interval(10000)
  async checkMonitors() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const monitors = await this.prisma.monitor.findMany({ where: { enabled: true }, select: { id: true, name: true, url: true, method: true } });

      await Promise.all(monitors.map(async (monitor) => {
        let status: 'UP' | 'DOWN' = 'DOWN';

        try {
          const response = await fetch(monitor.url, { method: monitor.method, signal: AbortSignal.timeout(5000), redirect: 'manual' });
          status = response.status >= 200 && response.status < 400 ? 'UP' : 'DOWN';
        } catch {
          status = 'DOWN';
        }

        await this.prisma.monitor.update({ where: { id: monitor.id }, data: { status } });
        this.logger.log(`${monitor.name}: ${status}`);
      }));
    } catch (error) {
      this.logger.error('Monitor check cycle failed', error instanceof Error ? error.stack : String(error));
    } finally {
      this.isRunning = false;
    }
  }
}
