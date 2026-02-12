import { JwtAuthGuard } from '@/packages/auth/guards/jwt-auth.guard';
import { ERoutes, paramSetRoute, validationMessage } from '@/shared/constants';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { response } from '@/shared/utils/rest-api/response';
import { Body, Controller, Get, Headers, HttpStatus, Inject, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CreateParamSetDto, PublishParamSetDto, QueryParamSetDto, RollbackParamSetDto } from '../dto';
import { ParamSetUsecasePort } from '../ports/usecase.port';

@Controller(`${ERoutes.PARAM_SET}${paramSetRoute.base}`)
@UseGuards(JwtAuthGuard)
export class ParamSetController {
  constructor(
    @Inject('ParamSetUsecasePort')
    private readonly usecase: ParamSetUsecasePort,
  ) {}

  @Post(paramSetRoute.createDraft)
  async createDraft(
    @Body() dto: CreateParamSetDto,
    @Headers('x-user-id') userId: string,
    @Headers('x-forwarded-for') ipAddress: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.usecase.createDraft(dto, userId, ipAddress);

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
        message: validationMessage('Parameter Set')[201](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in createDraft',
        error instanceof Error ? error.stack : undefined,
        'ParamSetController.createDraft',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Get(paramSetRoute.findActive)
  async findActive(@Query('environment') environment: string, @Res() res: Response) {
    try {
      const result = await this.usecase.findActive(environment || 'UAT');

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
        error instanceof Error ? error.message : 'Error in findActive',
        error instanceof Error ? error.stack : undefined,
        'ParamSetController.findActive',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Get(paramSetRoute.list)
  async findMany(@Query() query: QueryParamSetDto, @Res() res: Response) {
    try {
      const result = await this.usecase.findMany(query);

      if (result?.error) {
        return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
      }

      return response[HttpStatus.OK](res, {
        message: validationMessage()[200](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findMany',
        error instanceof Error ? error.stack : undefined,
        'ParamSetController.findMany',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Get(paramSetRoute.findOne)
  async findById(@Param('id') id: string, @Res() res: Response) {
    try {
      const result = await this.usecase.findById(id);

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
        error instanceof Error ? error.message : 'Error in findById',
        error instanceof Error ? error.stack : undefined,
        'ParamSetController.findById',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Post(paramSetRoute.publish)
  async publish(
    @Param('id') id: string,
    @Body() dto: PublishParamSetDto,
    @Headers('x-user-id') userId: string,
    @Headers('x-forwarded-for') ipAddress: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.usecase.publish(id, dto, userId, ipAddress);

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
        message: 'Parameter set published successfully',
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in publish',
        error instanceof Error ? error.stack : undefined,
        'ParamSetController.publish',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Post(paramSetRoute.rollback)
  async rollback(
    @Param('id') id: string,
    @Body() dto: RollbackParamSetDto,
    @Headers('x-user-id') userId: string,
    @Headers('x-forwarded-for') ipAddress: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.usecase.rollback(id, dto, userId, ipAddress);

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
        message: 'Parameter set rolled back successfully',
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in rollback',
        error instanceof Error ? error.stack : undefined,
        'ParamSetController.rollback',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }
}
