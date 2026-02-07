import { Roles } from '@/packages/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '@/packages/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/packages/auth/guards/roles.guard';
import { ERoutes } from '@/shared/constants/routes';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { response } from '@/shared/utils/rest-api/response';
import { Body, Controller, HttpStatus, Inject, Param, Patch, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { UpdateUserDto } from '../dto';
import { UserUsecasePort } from '../ports/usecase.port';

@Controller(ERoutes.USERS)
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(
    @Inject('UserUsecasePort')
    private readonly usecase: UserUsecasePort,
  ) {
    this.usecase = usecase;
  }

  @Patch('/:id')
  @Roles('GA', 'ADMIN')
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
}
