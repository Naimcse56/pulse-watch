import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { CreateMonitorDto } from './dto/create-monitor.dto';
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
}
