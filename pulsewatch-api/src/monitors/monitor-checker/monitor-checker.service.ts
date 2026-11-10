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

  // Auto run this function after every 10 seconds
  @Interval(10000)
  async checkMonitors(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;

    try {
      const now = new Date();

      // Fetch only monitors whose next check time has arrived.
      const monitors = await this.prisma.monitor.findMany({
        where: {
          enabled: true,
          nextCheckAt: {
            lte: now,
          },
        },
        select: {
          id: true,
          name: true,
          url: true,
          method: true,
          status: true,
          intervalSeconds: true,
        },
        orderBy: {
          nextCheckAt: 'asc',
        },
      });

      if (monitors.length === 0) {
        return;
      }

      this.logger.log(`${monitors.length} monitor(s) due for checking`);

      // Limit concurrent HTTP checks to 10.
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

              const alertType =
                result.status === 'DOWN' && previousStatus !== 'DOWN'
                  ? 'DOWN'
                  : result.status === 'UP' && previousStatus === 'DOWN'
                    ? 'RECOVERED'
                    : null;

              // Schedule the next check relative to this check's completion.
              const nextCheckAt = new Date(
                Date.now() + monitor.intervalSeconds * 1000,
              );

              await this.prisma.$transaction(async (tx) => {
                await tx.monitor.update({
                  where: {
                    id: monitor.id,
                  },
                  data: {
                    status: result.status,
                    nextCheckAt,
                  },
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

              this.logger.log(
                `${monitor.name}: ${result.status} | ` +
                  `HTTP ${result.httpStatusCode ?? 'N/A'} | ` +
                  `${result.responseTimeMs}ms | ` +
                  `Next check: ${nextCheckAt.toISOString()}`,
              );

              if (alertType) {
                this.logger.warn(
                  `${monitor.name}: ${alertType} alert created`,
                );
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
