import { Controller, Get, Patch, Param, Query, Req, UseGuards, BadRequestException, } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AlertsService } from './alerts.service';

@Controller('alerts')
@UseGuards(AuthGuard('jwt'))
export class AlertsController {
    constructor(private readonly alertsService: AlertsService) {}

    @Get()
    findAll(@Req() req: { user: { userId: string } }, @Query('page') page = '1', @Query('limit') limit = '20',)
    {
        const pageNumber = Number(page);
        const limitNumber = Number(limit);

        if (!Number.isInteger(pageNumber) || pageNumber < 1 || !Number.isInteger(limitNumber) || limitNumber < 1 || limitNumber > 100)
        {
            throw new BadRequestException(
            'page must be positive and limit must be between 1 and 100',
            );
        }

        return this.alertsService.findAll(
            req.user.userId,
            pageNumber,
            limitNumber,
        );
    }

    @Get('unread-count')
    getUnreadCount(@Req() req: { user: { userId: string } }) {
        return this.alertsService.getUnreadCount(req.user.userId);
    }

    @Patch(':id/read')
    markAsRead( @Param('id') id: string, @Req() req: { user: { userId: string } },)
    {
        return this.alertsService.markAsRead(id, req.user.userId);
    }
}
