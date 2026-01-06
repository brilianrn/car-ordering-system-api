import { approvalRoute, ERoutes, validationMessage } from '@/shared/constants';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { response } from '@/shared/utils/rest-api/response';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApproveBookingDto } from '../dto/approve-booking.dto';
import { QueryApprovalListDto } from '../dto/query-approval-list.dto';
import { ApprovalUsecasePort } from '../ports/usecase.port';

@Controller(`${ERoutes.BOOKINGS}${approvalRoute.base}`)
export class ApprovalController {
  constructor(
    @Inject('ApprovalUsecasePort')
    private readonly usecase: ApprovalUsecasePort,
  ) {}

  @Get(approvalRoute.list)
  async findApprovalList(
    @Query() query: QueryApprovalListDto,
    @Headers('x-user-id') userId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.usecase.findApprovalList(query, userId);

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
        message: validationMessage()[200](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findApprovalList',
        error instanceof Error ? error.stack : undefined,
        'ApprovalController.findApprovalList',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Patch(approvalRoute.approve)
  async approveBooking(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveBookingDto,
    @Headers('x-user-id') userId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.usecase.approveBooking(id, dto, userId);

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
        message: validationMessage('Booking')[200](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in approveBooking',
        error instanceof Error ? error.stack : undefined,
        'ApprovalController.approveBooking',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }
}
