import { Body, Controller, Delete, Get, Param, Patch, Post, Query, } from "@nestjs/common";
import { MonitorStatus } from '@prisma/client';

import { CreateMonitorDto } from "./dto/create-monitor.dto";
import { UpdateMonitorDto } from "./dto/update-monitor.dto";
import { MonitorsService } from "./monitors.service";

@Controller("monitors")
export class MonitorsController {
    constructor(private readonly monitorsService: MonitorsService) {}

    @Post()
    create(@Body() dto: CreateMonitorDto) {
        return this.monitorsService.create(dto);
    }

    @Get()
    findAll() {
        return this.monitorsService.findAll();
    }

    @Get("paginate")
    findByPaginate( @Query('page') page = '1', @Query('limit') limit = '10', ) {
        return this.monitorsService.findByPaginate(
                    Number(page),
                    Number(limit),
                );
    }

    @Get('search')
    findBySearchAndPaginate( @Query('page') page = '1', @Query('limit') limit = '10', @Query('search') search = '', @Query('status') status?: MonitorStatus, ) {
        return this.monitorsService.findBySearchAndPaginate(
                    Number(page),
                    Number(limit),
                    search,
                    status,
                );
    }

    @Get(":id")
    findOne(@Param("id") id: string) {
        return this.monitorsService.findOne(id);
    }

    @Patch(":id")
    update(@Param("id") id: string, @Body() dto: UpdateMonitorDto) {
        return this.monitorsService.update(id, dto);
    }

    @Delete(":id")
    remove(@Param("id") id: string) {
        return this.monitorsService.remove(id);
    }
}
