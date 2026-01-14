import { ERoutes, financeRoute, validationMessage } from '@/shared/constants';
import { response } from '@/shared/utils/rest-api/response';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { Body, Controller, Headers, HttpStatus, Inject, Param, ParseIntPipe, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { CloseTripDto, VerifyItemDto } from '../dto';
import { FinanceUsecasePort } from '../ports/usecase.port';

@Controller(`${ERoutes.BOOKINGS}${financeRoute.base}`)
export class FinanceController {
  constructor(
    @Inject('FinanceUsecasePort')
    private readonly usecase: FinanceUsecasePort,
  ) {}

  @Post(financeRoute.verifyItem)
  async verifyItem(@Body() dto: VerifyItemDto, @Headers('x-user-id') userId: string, @Res() res: Response) {
    try {
      if (!userId) {
        return response[HttpStatus.UNAUTHORIZED](res, {
          message: 'User ID is required',
        });
      }

      const result = await this.usecase.verifyItem(dto.itemId, dto, userId);

      if (result?.error) {
        const statusCode =
          result.error.code === 404
            ? HttpStatus.NOT_FOUND
            : result.error.code === 403
              ? HttpStatus.FORBIDDEN
              : HttpStatus.BAD_REQUEST;
        return response[statusCode](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
      }

      return response[HttpStatus.OK](res, {
        message: validationMessage('Receipt Item Verification')[200](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in verifyItem',
        error instanceof Error ? error.stack : undefined,
        'FinanceController.verifyItem',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }

  @Post(financeRoute.closeTrip)
  async closeTrip(
    @Param('executionId', ParseIntPipe) executionId: number,
    @Body() dto: CloseTripDto,
    @Headers('x-user-id') userId: string,
    @Res() res: Response,
  ) {
    try {
      if (!userId) {
        return response[HttpStatus.UNAUTHORIZED](res, {
          message: 'User ID is required',
        });
      }

      const result = await this.usecase.closeTrip(executionId, dto, userId);

      if (result?.error) {
        const statusCode =
          result.error.code === 404
            ? HttpStatus.NOT_FOUND
            : result.error.code === 403
              ? HttpStatus.FORBIDDEN
              : HttpStatus.BAD_REQUEST;
        return response[statusCode](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
      }

      return response[HttpStatus.OK](res, {
        message: validationMessage('Close Trip')[200](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in closeTrip',
        error instanceof Error ? error.stack : undefined,
        'FinanceController.closeTrip',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }
}
