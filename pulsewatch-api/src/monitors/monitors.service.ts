import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { CreateMonitorDto } from './dto/create-monitor.dto';
import { UpdateMonitorDto } from './dto/update-monitor.dto';
import { MonitorRecord } from './monitor.types';

@Injectable()
export class MonitorsService {
  private readonly monitors: MonitorRecord[] = [];

  create(dto: CreateMonitorDto): MonitorRecord {
    const monitor: MonitorRecord = {
      id: randomUUID(),
      name: dto.name,
      url: dto.url,
      method: dto.method,
      intervalSeconds: dto.intervalSeconds,
      enabled: dto.enabled ?? true,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    this.monitors.push(monitor);

    return monitor;
  }

  findAll(): MonitorRecord[] {
    return [...this.monitors];
  }

  findOne(id: string): MonitorRecord {
    const monitor = this.monitors.find((item) => item.id === id);

    if (!monitor) {
        throw new NotFoundException(`Monitor with ID ${id} not found`);
    }

    return monitor;
    }

    update(id: string, dto: UpdateMonitorDto): MonitorRecord {
    const index = this.monitors.findIndex((item) => item.id === id);

    if (index === -1) {
        throw new NotFoundException(`Monitor with ID ${id} not found`);
    }

    this.monitors[index] = {
        ...this.monitors[index],
        ...dto,
    };

    return this.monitors[index];
    }

    remove(id: string): MonitorRecord {
    const index = this.monitors.findIndex((item) => item.id === id);

    if (index === -1) {
        throw new NotFoundException(`Monitor with ID ${id} not found`);
    }

    const [deletedMonitor] = this.monitors.splice(index, 1);

    return deletedMonitor;
    }
}
