
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
  async checkMonitors(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const monitors = await this.prisma.monitor.findMany({
        where: { enabled: true },
        select: { id: true, name: true, url: true, method: true },
      });

      for (let i = 0; i < monitors.length; i += 10) {
        const batch = monitors.slice(i, i + 10);

        await Promise.all(
          batch.map(async (monitor) => {
            try {
              const result = await this.checker.check(
                monitor.url,
                monitor.method,
              );

              await this.prisma.$transaction([
                this.prisma.monitor.update({
                  where: { id: monitor.id },
                  data: { status: result.status },
                }),
                this.prisma.monitorCheck.create({
                  data: {
                    monitorId: monitor.id,
                    status: result.status,
                    httpStatusCode: result.httpStatusCode,
                    responseTimeMs: result.responseTimeMs,
                  },
                }),
              ]);

              this.logger.log(
                `${monitor.name}: ${result.status} | HTTP ${result.httpStatusCode ?? 'N/A'} | ${result.responseTimeMs}ms`,
              );
            } catch (error) {
              this.logger.error(
                `Failed to check or save monitor "${monitor.name}": ${
                  error instanceof Error ? error.message : String(error)
                }`,
              );
            }
          }),
        );
      }
    } catch (error) {
      this.logger.error(
        'Monitor check cycle failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isRunning = false;
    }
  }
}
