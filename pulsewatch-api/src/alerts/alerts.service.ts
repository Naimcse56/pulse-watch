
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, page = 1, limit = 20) {
    const where = {
      monitor: { userId },
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.monitorAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          monitor: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.monitorAlert.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.monitorAlert.count({
      where: {
        isRead: false,
        monitor: { userId },
      },
    });

    return { unreadCount: count };
  }
}
