import { JwtAuthGuard } from '@/packages/auth/guards/jwt-auth.guard';
import { Controller, Get, Headers, HttpStatus, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { globalLogger as Logger } from '../../../shared/utils/logger';
import { response } from '../../../shared/utils/rest-api/response';
import { QueryAnalyticsDto } from '../dto/query-analytics.dto';
import { AnalyticsUseCase } from '../usecase/analytics.usecase';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly useCase: AnalyticsUseCase) {}

  @Get('dashboard')
  async getDashboard(@Query() query: QueryAnalyticsDto, @Headers('x-user-id') userId: string, @Res() res: Response) {
    try {
      if (!userId) {
        return response[HttpStatus.UNAUTHORIZED](res, { message: 'User ID header missing' });
      }
      const data = await this.useCase.getDashboard(query, userId);
      return response[HttpStatus.OK](res, { message: 'Dashboard data retrieved successfully', data });
    } catch (error) {
      Logger.error(error);
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, { message: error.message });
    }
  }

  @Get('export')
  async exportDashboard(
    @Query() query: QueryAnalyticsDto,
    @Query('format') format: 'pdf' | 'xls',
    @Headers('x-user-id') userId: string,
    @Res() res: Response,
  ) {
    try {
      if (!userId) {
        return response[HttpStatus.UNAUTHORIZED](res, { message: 'User ID header missing' });
      }
      if (!format || !['pdf', 'xls'].includes(format)) {
        return response[HttpStatus.BAD_REQUEST](res, { message: 'Invalid format. Use pdf or xls' });
      }
      const buffer = await this.useCase.exportDashboard(query, userId, format);

      if (format === 'pdf') {
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename=dashboard-${new Date().toISOString()}.pdf`,
          'Content-Length': buffer.length,
        });
      } else {
        res.set({
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename=dashboard-${new Date().toISOString()}.xlsx`,
          'Content-Length': buffer.length,
        });
      }

      res.send(buffer);
    } catch (error) {
      Logger.error(error);
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, { message: error.message });
    }
  }
}
