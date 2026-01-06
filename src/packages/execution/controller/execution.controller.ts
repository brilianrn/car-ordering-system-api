import { ERoutes, executionRoute, validationMessage } from '@/shared/constants';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { response } from '@/shared/utils/rest-api/response';
import { Body, Controller, Headers, HttpStatus, Inject, Param, ParseIntPipe, Patch, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CheckInSegmentDto } from '../dto/check-in-segment.dto';
import { CheckOutSegmentDto } from '../dto/check-out-segment.dto';
import { UploadReceiptDto } from '../dto/upload-receipt.dto';
import { VerifyExecutionDto } from '../dto/verify-execution.dto';
import { ExecutionUsecasePort } from '../ports/usecase.port';

@Controller(`${ERoutes.BOOKINGS}${executionRoute.base}`)
export class ExecutionController {
  constructor(
    @Inject('ExecutionUsecasePort')
    private readonly usecase: ExecutionUsecasePort,
  ) {}

  @Post(executionRoute.checkIn)
  async checkInSegment(
    @Param('segmentId', ParseIntPipe) segmentId: number,
    @Body() dto: CheckInSegmentDto,
    @Headers('x-user-id') userId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.usecase.checkInSegment(segmentId, dto, userId);

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
        message: validationMessage('Check-in')[201](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in checkInSegment',
        error instanceof Error ? error.stack : undefined,
        'ExecutionController.checkInSegment',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Post(executionRoute.checkOut)
  async checkOutSegment(
    @Param('segmentId', ParseIntPipe) segmentId: number,
    @Body() dto: CheckOutSegmentDto,
    @Headers('x-user-id') userId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.usecase.checkOutSegment(segmentId, dto, userId);

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
        message: validationMessage('Check-out')[200](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in checkOutSegment',
        error instanceof Error ? error.stack : undefined,
        'ExecutionController.checkOutSegment',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Post(executionRoute.uploadReceipt)
  async uploadReceipt(
    @Param('executionId', ParseIntPipe) executionId: number,
    @Body() dto: UploadReceiptDto,
    @Headers('x-user-id') userId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.usecase.uploadReceipt(executionId, dto, userId);

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
        message: validationMessage('Receipt')[201](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in uploadReceipt',
        error instanceof Error ? error.stack : undefined,
        'ExecutionController.uploadReceipt',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Patch(executionRoute.verifyExecution)
  async verifyExecution(
    @Param('executionId', ParseIntPipe) executionId: number,
    @Body() dto: VerifyExecutionDto,
    @Headers('x-user-id') userId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.usecase.verifyExecution(executionId, dto, userId);

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
        message: validationMessage('Verification')[200](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in verifyExecution',
        error instanceof Error ? error.stack : undefined,
        'ExecutionController.verifyExecution',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }
}
