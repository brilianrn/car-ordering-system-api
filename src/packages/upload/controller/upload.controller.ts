import { ERoutes, uploadRoute, validationMessage } from '@/shared/constants';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { response } from '@/shared/utils/rest-api/response';
import { Body, Controller, Headers, HttpStatus, Inject, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { UploadDto } from '../dto/upload.dto';
import { UploadControllerPort } from '../ports/controller.port';
import { UploadUsecasePort } from '../ports/usecase.port';

@Controller(ERoutes.UPLOAD)
export class UploadController implements UploadControllerPort {
  constructor(
    @Inject('UploadUsecasePort')
    private readonly uploadUseCase: UploadUsecasePort,
  ) {
    this.uploadUseCase = uploadUseCase;
  }

  @Post(uploadRoute.upload)
  async upload(@Body() uploadDto: UploadDto, @Headers('x-user-id') userId: string, @Res() res: Response) {
    try {
      const result = await this.uploadUseCase.upload(uploadDto, userId || 'SYSTEM');

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
        error instanceof Error ? error.message : 'Error in upload',
        error instanceof Error ? error.stack : undefined,
        'UploadController.upload',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }
}
