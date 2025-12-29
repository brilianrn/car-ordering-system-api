import { ERoutes, driverRoute, validationMessage } from '@/shared/constants';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { response } from '@/shared/utils/rest-api/response';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CreateDriverDto } from '../dto/create-driver.dto';
import { EligibleDriverQueryDto } from '../dto/eligible-driver-query.dto';
import { ListDriverQueryDto } from '../dto/list-driver-query.dto';
import { UpdateDriverDto } from '../dto/update-driver.dto';
import { DriversControllerPort } from '../ports/controller.port';
import { DriversUseCase } from '../usecase/drivers.usecase';

@Controller(ERoutes.DRIVERS)
export class DriversController implements DriversControllerPort {
  constructor(private readonly driversUseCase: DriversUseCase) {}

  @Post(driverRoute.create)
  async create(@Body() createDto: CreateDriverDto, @Headers('x-user-id') userId: string, @Res() res: Response) {
    try {
      const result = await this.driversUseCase.create(createDto, userId);

      if (result?.error) {
        const statusCode =
          result.error.code === 409
            ? HttpStatus.CONFLICT
            : result.error.code === 400
              ? HttpStatus.BAD_REQUEST
              : HttpStatus.BAD_REQUEST;
        return response[statusCode](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
      }
      return response[HttpStatus.CREATED](res, {
        message: validationMessage('Driver')[201](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in create',
        error instanceof Error ? error.stack : undefined,
        'DriversController.create',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }

  @Get(driverRoute.list)
  async findAll(@Query() query: ListDriverQueryDto, @Res() res: Response) {
    try {
      const result = await this.driversUseCase.findAll(query);

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
        'DriversController.findAll',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }

  @Get(driverRoute.findOne)
  async findOne(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    try {
      const result = await this.driversUseCase.getDetail(id);

      if (result?.error) {
        const statusCode = result.error.code === 404 ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
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
        error instanceof Error ? error.message : 'Error in findOne',
        error instanceof Error ? error.stack : undefined,
        'DriversController.findOne',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }

  @Patch(driverRoute.update)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateDriverDto,
    @Headers('x-user-id') userId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.driversUseCase.update(id, updateDto, userId);

      if (result?.error) {
        const statusCode =
          result.error.code === 404
            ? HttpStatus.NOT_FOUND
            : result.error.code === 409
              ? HttpStatus.CONFLICT
              : result.error.code === 400
                ? HttpStatus.BAD_REQUEST
                : HttpStatus.BAD_REQUEST;
        return response[statusCode](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
      }
      return response[HttpStatus.OK](res, {
        message: validationMessage().updated,
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in update',
        error instanceof Error ? error.stack : undefined,
        'DriversController.update',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }

  @Delete(driverRoute.delete)
  async remove(@Param('id', ParseIntPipe) id: number, @Headers('x-user-id') userId: string, @Res() res: Response) {
    try {
      const result = await this.driversUseCase.remove(id, userId);

      if (result?.error) {
        const statusCode = result.error.code === 404 ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
        return response[statusCode](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
      }
      return response[HttpStatus.OK](res, {
        message: validationMessage().deleted,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in remove',
        error instanceof Error ? error.stack : undefined,
        'DriversController.remove',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }

  @Patch(driverRoute.restore)
  async restore(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    try {
      const result = await this.driversUseCase.restore(id);

      if (result?.error) {
        const statusCode = result.error.code === 404 ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
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
        error instanceof Error ? error.message : 'Error in restore',
        error instanceof Error ? error.stack : undefined,
        'DriversController.restore',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }

  @Get(driverRoute.eligible)
  async findEligible(@Query() query: EligibleDriverQueryDto, @Res() res: Response) {
    try {
      const result = await this.driversUseCase.findEligible(query);

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
        error instanceof Error ? error.message : 'Error in findEligible',
        error instanceof Error ? error.stack : undefined,
        'DriversController.findEligible',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }

  @Get(driverRoute.expiredSIM)
  async findExpiredSIM(@Res() res: Response) {
    try {
      const result = await this.driversUseCase.findExpiredSIM();

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
        error instanceof Error ? error.message : 'Error in findExpiredSIM',
        error instanceof Error ? error.stack : undefined,
        'DriversController.findExpiredSIM',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }
}
