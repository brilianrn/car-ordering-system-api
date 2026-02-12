import { Roles } from '@/packages/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '@/packages/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/packages/auth/guards/roles.guard';
import { ERoutes, validationMessage } from '@/shared/constants';
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
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { CreateCategoryDto, QueryCategoryDto, UpdateCategoryDto } from '../dto';
import { CategoryControllerPort } from '../ports/controller.port';
import { CategoryUsecasePort } from '../ports/usecase.port';

@Controller(ERoutes.CATEGORY)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.GA, Role.ADMIN, Role.USER, Role.DRIVER)
export class CategoryController implements CategoryControllerPort {
  constructor(
    @Inject('CategoryUsecasePort')
    private readonly usecase: CategoryUsecasePort,
  ) {}

  @Post()
  @Roles(Role.GA, Role.ADMIN)
  async create(@Body() dto: CreateCategoryDto, @Headers('x-user-id') userId: string, @Res() res: Response) {
    try {
      const result = await this.usecase.create(dto, userId);

      if (result?.error) {
        const statusCode =
          result.error.code === 404
            ? HttpStatus.NOT_FOUND
            : result.error.code === 409
              ? HttpStatus.CONFLICT
              : HttpStatus.BAD_REQUEST;
        response[statusCode](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
        return;
      }

      response[HttpStatus.CREATED](res, {
        message: validationMessage('Category')[201](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in create',
        error instanceof Error ? error.stack : undefined,
        'CategoryController.create',
      );
      response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Get()
  async findAll(@Query() query: QueryCategoryDto, @Res() res: Response) {
    try {
      const result = await this.usecase.findAll(query);

      if (result?.error) {
        response[HttpStatus.BAD_REQUEST](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
        return;
      }

      response[HttpStatus.OK](res, {
        message: validationMessage()[200](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findAll',
        error instanceof Error ? error.stack : undefined,
        'CategoryController.findAll',
      );
      response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    try {
      const result = await this.usecase.findOne(id);

      if (result?.error) {
        const statusCode = result.error.code === 404 ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
        response[statusCode](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
        return;
      }

      response[HttpStatus.OK](res, {
        message: validationMessage()[200](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findOne',
        error instanceof Error ? error.stack : undefined,
        'CategoryController.findOne',
      );
      response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Patch(':id')
  @Roles(Role.GA, Role.ADMIN)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
    @Headers('x-user-id') userId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.usecase.update(id, dto, userId);

      if (result?.error) {
        const statusCode =
          result.error.code === 404
            ? HttpStatus.NOT_FOUND
            : result.error.code === 409
              ? HttpStatus.CONFLICT
              : HttpStatus.BAD_REQUEST;
        response[statusCode](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
        return;
      }

      response[HttpStatus.OK](res, {
        message: validationMessage('Category')[200](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in update',
        error instanceof Error ? error.stack : undefined,
        'CategoryController.update',
      );
      response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Delete(':id')
  @Roles(Role.GA, Role.ADMIN)
  async delete(@Param('id', ParseIntPipe) id: number, @Headers('x-user-id') userId: string, @Res() res: Response) {
    try {
      const result = await this.usecase.delete(id, userId);

      if (result?.error) {
        const statusCode =
          result.error.code === 404
            ? HttpStatus.NOT_FOUND
            : result.error.code === 400
              ? HttpStatus.BAD_REQUEST
              : HttpStatus.INTERNAL_SERVER_ERROR;
        response[statusCode](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
        return;
      }

      response[HttpStatus.OK](res, {
        message: validationMessage('Category')[200](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in delete',
        error instanceof Error ? error.stack : undefined,
        'CategoryController.delete',
      );
      response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }

  @Get('export/csv')
  async exportToCsv(@Res() res: Response) {
    try {
      const result = await this.usecase.exportToCsv();

      if (result?.error) {
        Logger.error(`Export CSV error: ${result.error.message}`, undefined, 'CategoryController.exportToCsv');
        response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
        return;
      }

      if (!result?.data) {
        Logger.error('Export CSV returned no data', undefined, 'CategoryController.exportToCsv');
        response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
          message: 'No data available for export',
        });
        return;
      }

      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="categories_${new Date().toISOString().split('T')[0]}.csv"`,
      );

      res.send(result.data);
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in exportToCsv',
        error instanceof Error ? error.stack : undefined,
        'CategoryController.exportToCsv',
      );
      response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error instanceof Error ? error.message : validationMessage()[500](),
      });
    }
  }

  @Get('booking/active')
  async findActiveCategoriesForBooking(@Query('orgUnitCode') orgUnitCode: string | undefined, @Res() res: Response) {
    try {
      const result = await this.usecase.findActiveCategoriesForBooking(orgUnitCode);

      if (result?.error) {
        response[HttpStatus.BAD_REQUEST](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
        return;
      }

      response[HttpStatus.OK](res, {
        message: validationMessage()[200](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findActiveCategoriesForBooking',
        error instanceof Error ? error.stack : undefined,
        'CategoryController.findActiveCategoriesForBooking',
      );
      response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: error?.message || validationMessage()[500](),
      });
    }
  }
}
