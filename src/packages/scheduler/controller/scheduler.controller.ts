import { validationMessage } from '@/shared/constants/validation-message';
import { response } from '@/shared/utils/rest-api/response';
import { ResponseREST } from '@/shared/utils/rest-api/types';
import { Body, Controller, Get, Headers, HttpStatus, Inject, Logger, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { SyncSummaryDto, SyncTriggerDto } from '../dto';
import { SchedulerService } from '../usecase/scheduler.usecase';

@Controller('api/v1/scheduler')
export class SchedulerController {
  constructor(
    @Inject('SchedulerService')
    private readonly schedulerService: SchedulerService,
  ) {}

  @Post('sync/trigger')
  async triggerSync(
    @Body() body: SyncTriggerDto,
    @Headers('x-user-id') userId: string,
    @Res() res: Response,
  ): Promise<Response<ResponseREST<any>>> {
    try {
      const result = await this.schedulerService.triggerSync(body, userId);

      if (result?.error) {
        return response[HttpStatus.BAD_REQUEST](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
      }

      return response[HttpStatus.OK](res, {
        message: 'Sync triggered successfully',
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in triggerSync',
        error instanceof Error ? error.stack : undefined,
        'SchedulerController.triggerSync',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Get('sync/status')
  async getSyncStatus(
    @Headers('x-user-id') userId: string,
    @Res() res: Response,
  ): Promise<Response<ResponseREST<SyncSummaryDto>>> {
    try {
      const result = await this.schedulerService.getSyncStatus();

      if (result?.error) {
        return response[HttpStatus.BAD_REQUEST](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
      }

      return response[HttpStatus.OK](res, {
        message: 'Sync status retrieved successfully',
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in getSyncStatus',
        error instanceof Error ? error.stack : undefined,
        'SchedulerController.getSyncStatus',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Get('sync/history')
  async getSyncHistory(
    @Res() res: Response,
    @Headers('x-user-id') userId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<Response<ResponseREST<any>>> {
    try {
      const result = await this.schedulerService.getSyncHistory(limit, offset);

      if (result?.error) {
        return response[HttpStatus.BAD_REQUEST](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
      }

      return response[HttpStatus.OK](res, {
        message: 'Sync history retrieved successfully',
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in getSyncHistory',
        error instanceof Error ? error.stack : undefined,
        'SchedulerController.getSyncHistory',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Get('sync/summary')
  async getSyncSummary(
    @Headers('x-user-id') userId: string,
    @Res() res: Response,
  ): Promise<Response<ResponseREST<any>>> {
    try {
      const result = await this.schedulerService.getSyncSummary();

      if (result?.error) {
        return response[HttpStatus.BAD_REQUEST](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
      }

      return response[HttpStatus.OK](res, {
        message: 'Sync summary retrieved successfully',
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in getSyncSummary',
        error instanceof Error ? error.stack : undefined,
        'SchedulerController.getSyncSummary',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Post('cleanup')
  async cleanupOldData(
    @Res() res: Response,
    @Headers('x-user-id') userId: string,
    @Query('retentionDays') retentionDays?: number,
  ): Promise<Response<ResponseREST<any>>> {
    try {
      const result = await this.schedulerService.cleanupOldData(retentionDays);

      if (result?.error) {
        return response[HttpStatus.BAD_REQUEST](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
      }

      return response[HttpStatus.OK](res, {
        message: 'Data cleanup completed successfully',
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in cleanupOldData',
        error instanceof Error ? error.stack : undefined,
        'SchedulerController.cleanupOldData',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }
}
