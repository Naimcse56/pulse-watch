import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { HttpMethod as PrismaHttpMethod } from '@prisma/client';
import { MonitorStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMonitorDto } from './dto/create-monitor.dto';
import { UpdateMonitorDto } from './dto/update-monitor.dto';

@Injectable()
export class MonitorsService {
  constructor(private readonly prisma: PrismaService) {}
  create(dto: CreateMonitorDto) {
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
        ...(dto.userId ? {
                            user: {
                              // connect → Prisma Relation Connect
                              connect: { id: dto.userId },
                            },
                          } : {}),
      }
    });
  }

  findAll() {
    return this.prisma.monitor.findMany({
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

  findByPaginate(page = 1, limit = 10) {
    // To avoid negative or zero values for page and limit.
    page = Math.max(1, page);
    limit = Math.min(100, Math.max(1, limit));
    const skip = (page - 1) * limit;

    return this.prisma.monitor.findMany({
      skip,
      take: limit,
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findBySearchAndPaginate( page = 1, limit = 10, search = '', status?: MonitorStatus, ) {
    page = Math.max(1, page);
    limit = Math.min(100, Math.max(1, limit));

    const skip = (page - 1) * limit;

    const where = {
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

  async findOne(id: string) {
    const monitor = await this.prisma.monitor.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
    if (!monitor) {
      throw new NotFoundException(`Monitor with ID ${id} not found`);
    }

    return monitor;
  }

  async update(id: string, dto: UpdateMonitorDto) {
    await this.findOne(id);

    return this.prisma.monitor.update({
      where: { id },
      data: {
        ...dto,
        method: dto.method as PrismaHttpMethod | undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.monitor.delete({
      where: { id },
    });
  }
}
