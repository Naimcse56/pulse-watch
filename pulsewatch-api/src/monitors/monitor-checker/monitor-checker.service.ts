
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
        select: {
          id: true,
          name: true,
          url: true,
          method: true,
          status: true,
        },
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

              const previousStatus = monitor.status;

              const alertType = previousStatus === 'UP' && result.status === 'DOWN' ? 'DOWN' : previousStatus === 'DOWN' && result.status === 'UP' ? 'RECOVERED' : null;

              await this.prisma.$transaction(async (tx) => {
                await tx.monitor.update({
                  where: { id: monitor.id },
                  data: { status: result.status },
                });

                await tx.monitorCheck.create({
                  data: {
                    monitorId: monitor.id,
                    status: result.status,
                    httpStatusCode: result.httpStatusCode,
                    responseTimeMs: result.responseTimeMs,
                    failureReason: result.failureReason,
                  },
                });

                if (alertType) {
                  await tx.monitorAlert.create({
                    data: {
                      monitorId: monitor.id,
                      type: alertType,
                      message:
                        alertType === 'DOWN'
                          ? `Monitor "${monitor.name}" is DOWN`
                          : `Monitor "${monitor.name}" has RECOVERED`,
                    },
                  });
                }
              });

              this.logger.log(`${monitor.name}: ${result.status} | HTTP ${ result.httpStatusCode ?? 'N/A' } | ${result.responseTimeMs}ms`,);

              if (alertType) {
                this.logger.warn(`${monitor.name}: ${alertType} alert created`,);
              }
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
