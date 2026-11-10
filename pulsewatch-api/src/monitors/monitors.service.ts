import { Injectable, NotFoundException } from '@nestjs/common';
import { HttpMethod as PrismaHttpMethod, MonitorStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMonitorDto } from './dto/create-monitor.dto';
import { UpdateMonitorDto } from './dto/update-monitor.dto';
import { MonitorHistoryQueryDto } from './dto/monitor-history-query.dto';

@Injectable()
export class MonitorsService {
  constructor(private readonly prisma: PrismaService) {}
  async create(dto: CreateMonitorDto, userId: string) {
    // this = বর্তমান MonitorsService object।
    // prisma = Inject করা PrismaService।
    // this.prisma: PrismaService-এর instance
    // monitor = Prisma schema-এর Monitor model।
    return this.prisma.monitor.create({
      data: {
        name: dto.name,
        url: dto.url,
        method: dto.method as PrismaHttpMethod,
        intervalSeconds: dto.intervalSeconds,
        enabled: dto.enabled ?? true,
        user: {
          connect: {
            id: userId,
          },
        },
      }
    });
  }

  async findAll(userId: string) {
    return this.prisma.monitor.findMany({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { name: 'asc'},
    })
  }

  async findByPaginate(page = 1, limit = 10, userId: string) {
    // To avoid negative or zero values for page and limit.
    page = Math.max(1, page);
    limit = Math.min(100, Math.max(1, limit));
    const skip = (page - 1) * limit;

    return this.prisma.monitor.findMany({
      where: { userId },
      skip,
      take: limit,
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findBySearchAndPaginate( page = 1, limit = 10, search = '', userId: string, status?: MonitorStatus ) {
    page = Math.max(1, page);
    limit = Math.min(100, Math.max(1, limit));

    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(search && {
        OR: [
          {
            name: {
              contains: search,
              mode: 'insensitive' as const,
            },
          },
          {
            url: {
              contains: search,
              mode: 'insensitive' as const,
            },
          },
        ],
      }),

      ...(status && { status }),
    };

    const [monitors, total] = await Promise.all([
      this.prisma.monitor.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          name: 'asc',
        },
      }),

      this.prisma.monitor.count({ where }),
    ]);

    return {
      data: monitors,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), },
    };
  }

  async findOne(id: string, userId: string) {
    const monitor = await this.prisma.monitor.findFirst({ 
      where: { id, userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
     });
    if (!monitor) throw new NotFoundException('Monitor not found');
    return monitor;
  }

  async update(id: string, dto: UpdateMonitorDto, userId: string) {
    const result = await this.prisma.monitor.updateMany({
      where: { id, userId },
      data: {
        ...dto,
        method: dto.method as PrismaHttpMethod | undefined,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Monitor not found');
    }

    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string) {
    const result = await this.prisma.monitor.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Monitor not found');
    }

    return {
      message: 'Monitor deleted successfully',
    };
  }

  // MonitorCheckerHistory Pagination
  async findHistory(id: string, userId: string, query: MonitorHistoryQueryDto) {
    const monitor = await this.prisma.monitor.findFirst({
      where: { id, userId },
      select: {
        id: true,
        name: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!monitor) {
      throw new NotFoundException('Monitor not found');
    }

    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.monitorCheck.findMany({
        where: { monitorId: id },
        orderBy: { checkedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          status: true,
          httpStatusCode: true,
          responseTimeMs: true,
          checkedAt: true,
          failureReason: true,
        },
      }),
      this.prisma.monitorCheck.count({
        where: { monitorId: id },
      }),
    ]);

    return {
      monitor: {
        id: monitor.id,
        name: monitor.name,
      },
      owner: monitor.user
        ? {
            id: monitor.user.id,
            email: monitor.user.email,
          }
        : null,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Last 24 Hrs Statistics of Monitors
  // uptimePercentage: গত ২৪ ঘণ্টার successful UP checks ÷ মোট checks × ১০০।
  // averageResponseTimeMs: ওই সময়ের সব recorded checks-এর গড় response time।
  // totalChecks: মোট check সংখ্যা।
  // upChecks ও downChecks: পৃথক status-এর সংখ্যা।
  // কোনো history না থাকলে uptime ও average response time null থাকবে, ভুল করে 0% দেখাবে না।

  async getOverview(userId: string) {
    const monitors = await this.prisma.monitor.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        url: true,
        status: true,
        enabled: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (monitors.length === 0) {
      return { period: '24 hours', data: [] };
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const monitorIds = monitors.map((monitor) => monitor.id);

    const [statusGroups, responseGroups] = await Promise.all([
      this.prisma.monitorCheck.groupBy({
        by: ['monitorId', 'status'],
        where: {
          monitorId: { in: monitorIds },
          checkedAt: { gte: since },
        },
        _count: { _all: true },
      }),
      this.prisma.monitorCheck.groupBy({
        by: ['monitorId'],
        where: {
          monitorId: { in: monitorIds },
          checkedAt: { gte: since },
        },
        _avg: { responseTimeMs: true },
        _count: { _all: true },
      }),
    ]);

    const upCounts = new Map(
      statusGroups
        .filter((group) => group.status === 'UP')
        .map((group) => [group.monitorId, group._count._all]),
    );

    const statusCounts = new Map(
      statusGroups.map((group) => [
        `${group.monitorId}:${group.status}`,
        group._count._all,
      ]),
    );

    const responseStats = new Map(
      responseGroups.map((group) => [
        group.monitorId,
        {
          averageResponseTimeMs: group._avg.responseTimeMs === null
            ? null
            : Math.round(group._avg.responseTimeMs),
          totalChecks: group._count._all,
        },
      ]),
    );

    const data = monitors.map((monitor) => {
      const stats = responseStats.get(monitor.id);
      const totalChecks = stats?.totalChecks ?? 0;
      const upChecks = upCounts.get(monitor.id) ?? 0;
      const downChecks = statusCounts.get(`${monitor.id}:DOWN`) ?? 0;

      return {
        id: monitor.id,
        name: monitor.name,
        url: monitor.url,
        status: monitor.status,
        enabled: monitor.enabled,
        uptimePercentage: totalChecks > 0 ? Number(((upChecks / totalChecks) * 100).toFixed(2)) : null,
        averageResponseTimeMs: stats?.averageResponseTimeMs ?? null,
        totalChecks,
        upChecks,
        downChecks,
        ownerEmail: monitor.user ? monitor.user.email : null,
        ownerID: monitor.user ? monitor.user.id : null,
      };
    });

    return { period: '24 hours', data };
  }
}
