import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, Req, } from '@nestjs/common';

import { Request } from 'express';
import { MonitorStatus } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';

import { CreateMonitorDto } from './dto/create-monitor.dto';
import { UpdateMonitorDto } from './dto/update-monitor.dto';
import { MonitorsService } from './monitors.service';

import { MonitorHistoryQueryDto } from './dto/monitor-history-query.dto';
import { MonitorAlertQueryDto } from './dto/monitor-alert-query.dto';

type AuthenticatedRequest = Request & {
    user: {
    userId: string;
    email: string;
    };
};

@Controller('monitors')
@UseGuards(AuthGuard('jwt'))
export class MonitorsController {
    constructor(
    private readonly monitorsService: MonitorsService,
    ) {}

    @Post()
    create(@Body() dto: CreateMonitorDto, @Req() req: AuthenticatedRequest,) {
        return this.monitorsService.create(dto, req.user.userId);
    }

    @Get()
    findAll(@Req() req: AuthenticatedRequest) {
        return this.monitorsService.findAll(req.user.userId);
    }

    @Get('paginate')
    findByPaginate(@Query('page') page = '1', @Query('limit') limit = '10', @Req() req: AuthenticatedRequest,) {
        return this.monitorsService.findByPaginate(
            Number(page),
            Number(limit),
            req.user.userId,
        );
    }

    @Get('search')
    findBySearchAndPaginate(@Query('page') page = '1', @Query('limit') limit = '10', @Query('search') search = '', @Req() req: AuthenticatedRequest, @Query('status') status?: MonitorStatus,) {
        return this.monitorsService.findBySearchAndPaginate(
            Number(page),
            Number(limit),
            search,
            req.user.userId,
            status,
        );
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest,) {
        return this.monitorsService.findOne(id, req.user.userId);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateMonitorDto, @Req() req: AuthenticatedRequest,) {
        return this.monitorsService.update(id, dto, req.user.userId);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Req() req: AuthenticatedRequest,) {
        return this.monitorsService.remove(id, req.user.userId);
    }

    @Get('statistics/overview')
    @UseGuards(AuthGuard('jwt'))
    getOverview(@Req() req: Request & { user: { userId: string; email: string }; },)
    {
        return this.monitorsService.getOverview(req.user.userId);
    }

    @Get(':id/history')
    @UseGuards(AuthGuard('jwt'))
    getHistory(@Param('id') id: string, @Query() query: MonitorHistoryQueryDto, @Req() req: Request & { user: { userId: string; email: string } },)
    {
        return this.monitorsService.findHistory(id, req.user.userId, query);
    }

    @Get(':id/alerts')
    getAlerts(
    @Param('id') id: string,
    @Req() req: { user: { userId: string } },
    @Query() query: MonitorAlertQueryDto,
    ) {
    return this.monitorsService.findAlerts(
        id,
        req.user.userId,
        query,
    );
    }
}
