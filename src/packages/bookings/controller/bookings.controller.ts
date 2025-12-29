import { ERoutes, validationMessage, bookingRoute } from '@/shared/constants';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { response } from '@/shared/utils/rest-api/response';
import { Body, Controller, Get, Headers, HttpStatus, Inject, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { QueryBookingDto } from '../dto/query-booking.dto';
import { BookingsControllerPort } from '../ports/controller.port';
import { BookingsUsecasePort } from '../ports/usecase.port';

@Controller(ERoutes.BOOKINGS)
export class BookingsController implements BookingsControllerPort {
  constructor(
    @Inject('BookingsUsecasePort')
    private readonly usecase: BookingsUsecasePort,
  ) {
    this.usecase = usecase;
  }

  @Post(bookingRoute.create)
  async create(@Body() createDto: CreateBookingDto, @Headers('x-user-id') userId: string, @Res() res: Response) {
    try {
      // Use userId as requesterId (currently logged-in user)
      const requesterId = userId;

      if (!requesterId) {
        return response[HttpStatus.BAD_REQUEST](res, {
          message: 'User ID is required',
        });
      }

      const result = await this.usecase.create(createDto, requesterId, userId);

      if (result?.error) {
        const statusCode = result.error.code === 404 ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
        return response[statusCode](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
      }
      return response[HttpStatus.CREATED](res, {
        message: validationMessage('Booking')[201](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in create',
        error instanceof Error ? error.stack : undefined,
        'BookingsController.create',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Get(bookingRoute.list)
  async findAll(@Query() query: QueryBookingDto, @Headers('x-user-id') userId: string, @Res() res: Response) {
    try {
      // Use userId as requesterId for "My Bookings" filter
      const requesterId = userId;

      const result = await this.usecase.findAll(query, requesterId);

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
        error instanceof Error ? error.message : 'Error in findAll',
        error instanceof Error ? error.stack : undefined,
        'BookingsController.findAll',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }
}
