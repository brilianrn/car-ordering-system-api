import { Controller, Get, Post, Patch, Body, Headers, Param, ParseIntPipe, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ERoutes, validationMessage } from '@/shared/constants';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { response } from '@/shared/utils/rest-api/response';
import { CarpoolUseCase } from '../usecase/carpool.usecase';
import { FindCandidatesDto, InviteCarpoolDto, RespondInviteDto, MergeCarpoolDto, UnmergeCarpoolDto } from '../dto';

@Controller(`${ERoutes.BOOKINGS}/carpool`)
export class CarpoolController {
  constructor(private readonly usecase: CarpoolUseCase) {}

  /**
   * GET /api/v1/booking/carpool/candidates/:hostBookingId
   * Find carpool candidates for a host booking
   */
  @Get('candidates/:hostBookingId')
  async findCandidates(
    @Param('hostBookingId', ParseIntPipe) hostBookingId: number,
    @Headers('x-user-id') userId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.usecase.findCandidates({ hostBookingId }, userId);

      if (result?.error) {
        return response[result.error.code || HttpStatus.BAD_REQUEST](res, {
          message: result.error.message || validationMessage()[500](),
        });
      }

      return response[HttpStatus.OK](res, {
        message: validationMessage()[200](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findCandidates',
        error instanceof Error ? error.stack : undefined,
        'CarpoolController.findCandidates',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  /**
   * POST /api/v1/booking/carpool/invite
   * Invite a booking to join carpool
   */
  @Post('invite')
  async inviteCarpool(@Body() dto: InviteCarpoolDto, @Headers('x-user-id') userId: string, @Res() res: Response) {
    try {
      const result = await this.usecase.inviteCarpool(dto, userId);

      if (result?.error) {
        return response[result.error.code || HttpStatus.BAD_REQUEST](res, {
          message: result.error.message || validationMessage()[500](),
        });
      }

      return response[HttpStatus.CREATED](res, {
        message: validationMessage('Carpool Invite')[201](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in inviteCarpool',
        error instanceof Error ? error.stack : undefined,
        'CarpoolController.inviteCarpool',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  /**
   * PATCH /api/v1/booking/carpool/invite/:inviteId/respond
   * Respond to carpool invite (approve or decline)
   */
  @Patch('invite/:inviteId/respond')
  async respondInvite(
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Body() dto: RespondInviteDto,
    @Headers('x-user-id') userId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.usecase.respondInvite({ ...dto, inviteId }, userId);

      if (result?.error) {
        return response[result.error.code || HttpStatus.BAD_REQUEST](res, {
          message: result.error.message || validationMessage()[500](),
        });
      }

      return response[HttpStatus.OK](res, {
        message: validationMessage()[200](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in respondInvite',
        error instanceof Error ? error.stack : undefined,
        'CarpoolController.respondInvite',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  /**
   * POST /api/v1/booking/carpool/merge
   * Merge carpool group
   */
  @Post('merge')
  async mergeCarpool(@Body() dto: MergeCarpoolDto, @Headers('x-user-id') userId: string, @Res() res: Response) {
    try {
      const result = await this.usecase.mergeCarpool(dto, userId);

      if (result?.error) {
        return response[result.error.code || HttpStatus.BAD_REQUEST](res, {
          message: result.error.message || validationMessage()[500](),
        });
      }

      return response[HttpStatus.OK](res, {
        message: validationMessage()[200](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in mergeCarpool',
        error instanceof Error ? error.stack : undefined,
        'CarpoolController.mergeCarpool',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  /**
   * POST /api/v1/booking/carpool/unmerge
   * Unmerge carpool group
   */
  @Post('unmerge')
  async unmergeCarpool(@Body() dto: UnmergeCarpoolDto, @Headers('x-user-id') userId: string, @Res() res: Response) {
    try {
      const result = await this.usecase.unmergeCarpool(dto, userId);

      if (result?.error) {
        return response[result.error.code || HttpStatus.BAD_REQUEST](res, {
          message: result.error.message || validationMessage()[500](),
        });
      }

      return response[HttpStatus.OK](res, {
        message: validationMessage()[200](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in unmergeCarpool',
        error instanceof Error ? error.stack : undefined,
        'CarpoolController.unmergeCarpool',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }
}
