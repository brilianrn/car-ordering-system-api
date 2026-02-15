import { JwtAuthGuard } from '@/packages/auth/guards/jwt-auth.guard';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { response } from '@/shared/utils/rest-api/response';
import { Controller, Get, HttpStatus, Inject, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { EmployeesControllerPort } from '../ports/controller.port';
import { EmployeesUsecasePort } from '../ports/usecase.port';

@Controller('/api/v1/employees')
@UseGuards(JwtAuthGuard)
export class EmployeesController implements EmployeesControllerPort {
  constructor(
    @Inject('EmployeesUsecasePort')
    private readonly usecase: EmployeesUsecasePort,
  ) {}

  @Get('/search')
  async search(@Query('q') q = '', @Res() res: Response, @Query('roles') rolesStr?: string) {
    try {
      const roles = rolesStr ? rolesStr.split(',') : undefined;
      const result = await this.usecase.search(q, roles);

      if (result?.error) {
        return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
          message: result.error.message || '',
        });
      }

      return response[HttpStatus.OK](res, {
        message: 'Employees found',
        data: result.data || [],
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error in search controller',
        error instanceof Error ? error.stack : undefined,
        'EmployeesController.search',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: 'An error occurred while searching employees',
      });
    }
  }
}
