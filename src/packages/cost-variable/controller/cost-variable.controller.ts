import { ERoutes, costVariableRoute, validationMessage } from '@/shared/constants';
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
import { CreateCostVariableDto } from '../dto/create-cost-variable.dto';
import { QueryCostVariableDto } from '../dto/query-cost-variable.dto';
import { UpdateCostVariableDto } from '../dto/update-cost-variable.dto';
import { CostVariableControllerPort } from '../ports/controller.port';
import { CostVariableUseCase } from '../usecase/cost-variable.usecase';

@Controller(ERoutes.COST_VARIABLE)
export class CostVariableController implements CostVariableControllerPort {
  constructor(private readonly costVariableUseCase: CostVariableUseCase) {}

  @Post(costVariableRoute.create)
  async create(@Body() createDto: CreateCostVariableDto, @Headers('x-user-id') userId: string, @Res() res: Response) {
    try {
      const result = await this.costVariableUseCase.create(createDto, userId);

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
        message: validationMessage('Cost Variable')[201](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in create',
        error instanceof Error ? error.stack : undefined,
        'CostVariableController.create',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }

  @Get(costVariableRoute.list)
  async findAll(@Query() query: QueryCostVariableDto, @Res() res: Response) {
    try {
      const result = await this.costVariableUseCase.findAll(query);

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
        'CostVariableController.findAll',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }

  @Get(costVariableRoute.findOne)
  async findOne(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    try {
      const result = await this.costVariableUseCase.findOne(id);

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
        'CostVariableController.findOne',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }

  @Patch(costVariableRoute.update)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateCostVariableDto,
    @Headers('x-user-id') userId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.costVariableUseCase.update(id, updateDto, userId);

      if (result?.error) {
        const statusCode = result.error.code === 404 ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
        return response[statusCode](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
      }
      return response[HttpStatus.OK](res, {
        message: validationMessage('Cost Variable')[200](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in update',
        error instanceof Error ? error.stack : undefined,
        'CostVariableController.update',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }

  @Delete(costVariableRoute.delete)
  async delete(@Param('id', ParseIntPipe) id: number, @Headers('x-user-id') userId: string, @Res() res: Response) {
    try {
      const result = await this.costVariableUseCase.delete(id, userId);

      if (result?.error) {
        const statusCode = result.error.code === 404 ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
        return response[statusCode](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
      }
      return response[HttpStatus.OK](res, {
        message: validationMessage('Cost Variable')[200](),
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in delete',
        error instanceof Error ? error.stack : undefined,
        'CostVariableController.delete',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }

  @Post(costVariableRoute.restore)
  async restore(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    try {
      const result = await this.costVariableUseCase.restore(id);

      if (result?.error) {
        const statusCode =
          result.error.code === 404
            ? HttpStatus.NOT_FOUND
            : result.error.code === 400
              ? HttpStatus.BAD_REQUEST
              : HttpStatus.BAD_REQUEST;
        return response[statusCode](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
      }
      return response[HttpStatus.OK](res, {
        message: validationMessage('Cost Variable')[200](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in restore',
        error instanceof Error ? error.stack : undefined,
        'CostVariableController.restore',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }
}

