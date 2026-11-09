import { Injectable, NotFoundException } from '@nestjs/common';
import { HttpMethod as PrismaHttpMethod, MonitorStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMonitorDto } from './dto/create-monitor.dto';
import { UpdateMonitorDto } from './dto/update-monitor.dto';

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
}
