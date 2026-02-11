import { Roles } from '@/packages/auth/decorators/roles.decorator';
import { ERoutes } from '@/shared/constants/routes';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { response } from '@/shared/utils/rest-api/response';
import { Body, Controller, Delete, Get, HttpStatus, Inject, Param, Patch, Query, Req, Res } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { ListUserQueryDto, UpdateRolesDto, UpdateUserDto } from '../dto';
import { UserUsecasePort } from '../ports/usecase.port';

@Controller([ERoutes.USER, ERoutes.USERS])
// @UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(
    @Inject('UserUsecasePort')
    private readonly usecase: UserUsecasePort,
  ) {
    this.usecase = usecase;
  }

  @Get('')
  @Roles(Role.GA, Role.ADMIN)
  async findAll(@Query() query: ListUserQueryDto, @Res() res: Response) {
    try {
      const result = await this.usecase.findAll(query);
      if (result.error) {
        return response[result.error.code || HttpStatus.BAD_REQUEST](res, {
          message: result.error.message,
        });
      }
      return response[HttpStatus.OK](res, {
        message: 'Users fetched successfully',
        data: result.data,
      });
    } catch (error) {
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: 'An error occurred while fetching users',
      });
    }
  }

  @Get('/:id')
  @Roles(Role.GA, Role.ADMIN)
  async findOne(@Param('id') employeeId: string, @Res() res: Response) {
    try {
      const result = await this.usecase.findOne(employeeId);
      if (result.error) {
        return response[result.error.code || HttpStatus.NOT_FOUND](res, {
          message: result.error.message,
        });
      }
      return response[HttpStatus.OK](res, {
        message: 'User fetched successfully',
        data: result.data,
      });
    } catch (error) {
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: 'An error occurred while fetching user',
      });
    }
  }

  @Patch('/:id')
  @Roles(Role.GA, Role.ADMIN)
  async updateUser(@Param('id') employeeId: string, @Body() dto: UpdateUserDto, @Res() res: Response) {
    try {
      const result = await this.usecase.updateUser(employeeId, dto);

      if (result?.error) {
        const statusCode = result.error.code || HttpStatus.BAD_REQUEST;
        return response[statusCode](res, {
          message: result.error.message,
        });
      }

      return response[HttpStatus.OK](res, {
        message: result.data?.message || 'User updated successfully',
        data: { employeeId: result.data?.employeeId },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error in updateUser controller',
        error instanceof Error ? error.stack : undefined,
        'UserController.updateUser',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: 'An error occurred while updating user',
      });
    }
  }

  @Patch('/:id/roles')
  @Roles(Role.GA, Role.ADMIN)
  async updateRoles(
    @Param('id') employeeId: string,
    @Body() dto: UpdateRolesDto,
    @Res() res: Response,
    @Req() req: any,
  ) {
    try {
      const actorId = (req.user?.employeeId as string) || 'SYSTEM';
      const result = await this.usecase.updateRoles(employeeId, dto, actorId);

      if (result?.error) {
        return response[result.error.code || HttpStatus.BAD_REQUEST](res, {
          message: result.error.message,
        });
      }

      return response[HttpStatus.OK](res, {
        message: result.data?.message || 'Roles updated successfully',
        data: { employeeId: result.data?.employeeId },
      });
    } catch (error) {
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: 'An error occurred while updating roles',
      });
    }
  }

  @Delete('/:id')
  @Roles(Role.GA, Role.ADMIN)
  async remove(@Param('id') employeeId: string, @Res() res: Response, @Req() req: any) {
    try {
      const actorId = req.user?.employeeId || 'SYSTEM';
      const result = await this.usecase.remove(employeeId, actorId);

      if (result?.error) {
        return response[result.error.code || HttpStatus.BAD_REQUEST](res, {
          message: result.error.message,
        });
      }

      return response[HttpStatus.OK](res, {
        message: 'User deleted successfully',
      });
    } catch (error) {
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: 'An error occurred while deleting user',
      });
    }
  }
}
