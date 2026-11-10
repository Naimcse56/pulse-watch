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
          OR: [
            { claimUntil: null },
            { claimUntil: { lte: now } },
          ],
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
      // // Limit concurrent HTTP checks to 10 from env
      const concurrency = Math.max( 1, Number(process.env.MONITOR_CHECK_CONCURRENCY) || 10, );
      
      for (let i = 0; i < monitors.length; i += concurrency) {
        const batch = monitors.slice(i, i + concurrency);

        await Promise.all(
          batch.map(async (monitor) => {
            try {
              // STEP 1:
              // বর্তমান সময় নিচ্ছি। এই সময়ের আগে nextCheckAt হলে
              // monitor-টি check করার জন্য due হয়েছে।
              const claimTime = new Date();

              // STEP 2:
              // পরবর্তী ৬০ সেকেন্ডের জন্য monitor-টি reserve করছি।
              // এই সময়ের মধ্যে অন্য server যেন একই monitor claim না করে।
              const claimUntil = new Date(
                claimTime.getTime() + 60_000,
              );

              // STEP 3:
              // Atomic conditional update দিয়ে monitor claim করছি।
              // Monitor এখনো due এবং অন্য কেউ claim করেনি,
              // শুধু তখনই claimUntil update হবে।
              const claim = await this.prisma.monitor.updateMany({
                where: {
                  id: monitor.id,
                  enabled: true,

                  // Monitor-এর check করার সময় এসে গেছে কি না।
                  nextCheckAt: {
                    lte: claimTime,
                  },

                  // Monitor এখনো claim করা নেই,
                  // অথবা আগের claim-এর সময় শেষ হয়েছে।
                  OR: [
                    { claimUntil: null },
                    { claimUntil: { lte: claimTime } },
                  ],
                },
                data: {
                  // Temporary lock-এর expiry time save করছি।
                  claimUntil,
                },
              });

              // STEP 4:
              // count = 0 হলে monitor-টি claim করা যায়নি।
              // অন্য server আগে claim করে থাকতে পারে,
              // অথবা monitor আর due/enabled নেই।
              // তাই এই monitor-এর check skip করছি।
              if (claim.count === 0) {
                this.logger.debug(
                  `${monitor.name}: Skipped because claim failed`,
                );
                return;
              }

              // STEP 5:
              // Claim সফল হয়েছে। এখনই HTTP request/check চালানো নিরাপদ।
              const result = await this.checker.check(
                monitor.url,
                monitor.method,
              );

              // STEP 6:
              // আগের status-এর সঙ্গে নতুন status তুলনা করে
              // প্রয়োজন হলে DOWN বা RECOVERED alert তৈরি করব।
              const previousStatus = monitor.status;

              const alertType =
                result.status === 'DOWN' && previousStatus !== 'DOWN'
                  ? 'DOWN'
                  : result.status === 'UP' && previousStatus === 'DOWN'
                    ? 'RECOVERED'
                    : null;

              // STEP 7:
              // Check শেষ হওয়ার পর interval অনুযায়ী পরবর্তী check-এর
              // সময় নির্ধারণ করছি।
              const nextCheckAt = new Date(
                Date.now() + monitor.intervalSeconds * 1000,
              );

              // STEP 8:
              // Status, next check time, history ও alert একই transaction-এ
              // save করছি। claimUntil null করে lock মুক্ত করছি।
              await this.prisma.$transaction(async (tx) => {
                await tx.monitor.update({
                  where: {
                    id: monitor.id,
                  },
                  data: {
                    status: result.status,
                    nextCheckAt,
                    claimUntil: null,
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
                  `Next check: ${nextCheckAt.toISOString()}`,
              );
            } catch (error) {
              // Check বা database save ব্যর্থ হলে error log করছি।
              // claimUntil সময় শেষ হলে monitor আবার claim করা যাবে।
              this.logger.error(
                `Failed to check monitor "${monitor.name}": ${
                  error instanceof Error
                    ? error.message
                    : String(error)
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
