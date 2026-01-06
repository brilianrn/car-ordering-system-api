import { assignmentRoute, ERoutes, validationMessage } from '@/shared/constants';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { response } from '@/shared/utils/rest-api/response';
import { Body, Controller, Headers, HttpStatus, Inject, Param, ParseIntPipe, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AssignBookingDto } from '../dto/assign-booking.dto';
import { AssignmentUsecasePort } from '../ports/usecase.port';

@Controller(`${ERoutes.BOOKINGS}${assignmentRoute.base}`)
export class AssignmentController {
  constructor(
    @Inject('AssignmentUsecasePort')
    private readonly usecase: AssignmentUsecasePort,
  ) {}

  @Post(assignmentRoute.assign)
  async assignBooking(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignBookingDto,
    @Headers('x-user-id') userId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.usecase.assignBooking(id, dto, userId);

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

      return response[HttpStatus.CREATED](res, {
        message: validationMessage('Assignment')[201](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in assignBooking',
        error instanceof Error ? error.stack : undefined,
        'AssignmentController.assignBooking',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }
}
