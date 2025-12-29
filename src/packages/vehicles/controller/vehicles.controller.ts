import { ERoutes, validationMessage, vehicleRoute } from '@/shared/constants';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { response } from '@/shared/utils/rest-api/response';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CreateVehicleDto } from '../dto/create-vehicle.dto';
import { QueryVehicleDto } from '../dto/query-vehicle.dto';
import { UpdateVehicleDto } from '../dto/update-vehicle.dto';
import { VehiclesControllerPort } from '../ports/controller.port';
import { VehiclesUsecasePort } from '../ports/usecase.port';

@Controller(ERoutes.VEHICLES)
export class VehiclesController implements VehiclesControllerPort {
  constructor(
    @Inject('VehiclesUsecasePort')
    private readonly usecase: VehiclesUsecasePort,
  ) {
    this.usecase = usecase;
  }

  @Get(vehicleRoute.list)
  async findAll(@Query() query: QueryVehicleDto, @Res() res: Response) {
    try {
      const result = await this.usecase.findAll(query);

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
        error instanceof Error ? error.message : 'Error in restore',
        error instanceof Error ? error.stack : undefined,
        'VehiclesController.restore',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }

  @Get(vehicleRoute.detail)
  async findDetail(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    try {
      const result = await this.usecase.findDetail(id);

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
        error instanceof Error ? error.message : 'Error in findDetail',
        error instanceof Error ? error.stack : undefined,
        'VehiclesController.findDetail',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }

  @Get(vehicleRoute.findOne)
  async findOne(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    try {
      const result = await this.usecase.findOne(id);

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
        'VehiclesController.findOne',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Post(vehicleRoute.create)
  async create(@Body() createDto: CreateVehicleDto, @Headers('x-user-id') userId: string, @Res() res: Response) {
    try {
      const result = await this.usecase.create(createDto, userId);

      if (result?.error) {
        const statusCode = result.error.code === 409 ? HttpStatus.CONFLICT : HttpStatus.BAD_REQUEST;
        return response[statusCode](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
      }
      return response[HttpStatus.CREATED](res, {
        message: validationMessage('Vehicle')[201](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in create',
        error instanceof Error ? error.stack : undefined,
        'VehiclesController.create',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Patch(vehicleRoute.update)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateVehicleDto,
    @Headers('x-user-id') userId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.usecase.update(id, updateDto, userId);

      if (result?.error) {
        const statusCode =
          result.error.code === 404
            ? HttpStatus.NOT_FOUND
            : result.error.code === 409
              ? HttpStatus.CONFLICT
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
        'VehiclesController.update',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Delete(vehicleRoute.delete)
  async remove(@Param('id', ParseIntPipe) id: number, @Headers('x-user-id') userId: string, @Res() res: Response) {
    try {
      const result = await this.usecase.remove(id, userId);

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
        'VehiclesController.remove',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Put(vehicleRoute.restore)
  async restore(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    try {
      const result = await this.usecase.restore(id);

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
        'VehiclesController.restore',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Get(vehicleRoute.lovOrganizations)
  async lovOrganizations(@Res() res: Response) {
    try {
      const result = await this.usecase.lovOrganizations();

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
        error instanceof Error ? error.message : 'Error in lovOrganizations',
        error instanceof Error ? error.stack : undefined,
        'VehiclesController.lovOrganizations',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }
}
