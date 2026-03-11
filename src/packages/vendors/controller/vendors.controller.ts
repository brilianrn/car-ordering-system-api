import { Roles } from '@/packages/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '@/packages/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/packages/auth/guards/roles.guard';
import { ERoutes, validationMessage, vendorRoute } from '@/shared/constants';
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
import { CreateVendorDto } from '../dto/create-vendor.dto';
import { QueryVendorDto } from '../dto/query-vendor.dto';
import { UpdateVendorDto } from '../dto/update-vendor.dto';
import { VendorsControllerPort } from '../ports/controller.port';
import { VendorsUsecasePort } from '../ports/usecase.port';

@Controller(ERoutes.VENDORS)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.GA, Role.ADMIN)
export class VendorsController implements VendorsControllerPort {
  constructor(
    @Inject('VendorsUsecasePort')
    private readonly usecase: VendorsUsecasePort,
  ) {
    this.usecase = usecase;
  }

  @Get(vendorRoute.options)
  async findOptions(@Res() res: Response) {
    try {
      const result = await this.usecase.findOptions();
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
        error instanceof Error ? error.message : 'Error in findOptions',
        error instanceof Error ? error.stack : undefined,
        'VendorsController.findOptions',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }

  @Get(vendorRoute.list)
  async findAll(@Query() query: QueryVendorDto, @Res() res: Response) {
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
        error instanceof Error ? error.message : 'Error in findAll',
        error instanceof Error ? error.stack : undefined,
        'VendorsController.findAll',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }

  @Get(vendorRoute.findOne)
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
        'VendorsController.findOne',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }

  @Post(vendorRoute.create)
  async create(@Body() createDto: CreateVendorDto, @Headers('x-user-id') userId: string, @Res() res: Response) {
    try {
      const result = await this.usecase.create(createDto, userId);
      if (result?.error) {
        const statusCode = result.error.code === 409 ? HttpStatus.CONFLICT : HttpStatus.BAD_REQUEST;
        return response[statusCode](res, {
          message: result?.error?.message || validationMessage()[500](),
        });
      }
      return response[HttpStatus.CREATED](res, {
        message: validationMessage('Vendor')[201](),
        data: result?.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in create',
        error instanceof Error ? error.stack : undefined,
        'VendorsController.create',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }

  @Patch(vendorRoute.update)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateVendorDto,
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
        'VendorsController.update',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }

  @Delete(vendorRoute.delete)
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
        'VendorsController.remove',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: (error instanceof Error ? error.message : undefined) || validationMessage()[500](),
      });
    }
  }
}
