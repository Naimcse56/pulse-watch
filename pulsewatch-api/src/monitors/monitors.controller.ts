import { Body, Controller, Get, Post } from '@nestjs/common';

import { CreateMonitorDto } from './dto/create-monitor.dto';
import { MonitorsService } from './monitors.service';

@Controller('monitors')
export class MonitorsController {
  constructor(
    private readonly monitorsService: MonitorsService,
  ) {}

  @Post()
  create(@Body() dto: CreateMonitorDto) {
    return this.monitorsService.create(dto);
  }

  @Get()
  findAll() {
    return this.monitorsService.findAll();
  }
}
