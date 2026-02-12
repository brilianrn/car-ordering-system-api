import { JwtAuthGuard } from '@/packages/auth/guards/jwt-auth.guard';
import { validationMessage } from '@/shared/constants/validation-message';
import { response } from '@/shared/utils/rest-api/response';
import { ResponseREST } from '@/shared/utils/rest-api/types';
import { Body, Controller, Get, Headers, HttpStatus, Logger, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ChartData, DashboardData, RecapData, ReportSummary } from '../domain/types';
import { ExportReportDto, RecapQueryDto, ReportQueryDto } from '../dto/report-query.dto';
import { ReportsControllerPort } from '../ports/controller.port';
import { ReportsService } from '../usecase/reports.usecase';

@Controller('api/v1/reports')
@UseGuards(JwtAuthGuard)
export class ReportsController implements ReportsControllerPort {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  async getDashboard(
    @Query() query: ReportQueryDto,
    @Headers('x-user-id') userId: string,
    @Res() res: Response,
  ): Promise<Response<ResponseREST<DashboardData>>> {
    try {
      const result = await this.reportsService.getDashboard(query, userId);

      if (result?.error) {
        return response[HttpStatus.BAD_REQUEST](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
      }
      return response[HttpStatus.OK](res, {
        message: validationMessage()[200](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in getDashboard',
        error instanceof Error ? error.stack : undefined,
        'ReportsController.getDashboard',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Get('summary')
  async getSummary(
    @Query() query: ReportQueryDto,
    @Headers('x-user-id') userId: string,
    @Res() res: Response,
  ): Promise<Response<ResponseREST<ReportSummary>>> {
    try {
      const result = await this.reportsService.getSummary(query, userId);

      if (result?.error) {
        return response[HttpStatus.BAD_REQUEST](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
      }
      return response[HttpStatus.OK](res, {
        message: validationMessage()[200](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in getSummary',
        error instanceof Error ? error.stack : undefined,
        'ReportsController.getSummary',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Get('charts')
  async getCharts(
    @Query() query: ReportQueryDto,
    @Headers('x-user-id') userId: string,
    @Res() res: Response,
  ): Promise<Response<ResponseREST<ChartData>>> {
    try {
      const result = await this.reportsService.getCharts(query, userId);

      if (result?.error) {
        return response[HttpStatus.BAD_REQUEST](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
      }
      return response[HttpStatus.OK](res, {
        message: validationMessage()[200](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in getCharts',
        error instanceof Error ? error.stack : undefined,
        'ReportsController.getCharts',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Get('recap')
  async getRecap(
    @Query() query: RecapQueryDto,
    @Headers('x-user-id') userId: string,
    @Res() res: Response,
  ): Promise<Response<ResponseREST<RecapData>>> {
    try {
      const result = await this.reportsService.getRecap(query, userId);

      if (result?.error) {
        return response[HttpStatus.BAD_REQUEST](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
      }
      return response[HttpStatus.OK](res, {
        message: validationMessage()[200](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in getRecap',
        error instanceof Error ? error.stack : undefined,
        'ReportsController.getRecap',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Post('export')
  async exportReport(
    @Body() body: ExportReportDto,
    @Headers('x-user-id') userId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const result = await this.reportsService.exportReport(body, userId);

      if (result.error) {
        res.status(HttpStatus.BAD_REQUEST).json({
          message: result.error.message || validationMessage()[500](),
        });
        return;
      }

      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = body.filename || `COS-Report-${timestamp}`;

      if (body.format === 'xls') {
        res.set({
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
          'Content-Length': result.data!.length.toString(),
        });
        res.send(result.data);
      } else {
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}.pdf"`,
          'Content-Length': result.data!.length.toString(),
        });
        res.send(result.data);
      }
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in exportReport',
        error instanceof Error ? error.stack : undefined,
        'ReportsController.exportReport',
      );
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: error?.message || validationMessage()[500](),
      });
    }
  }
}
