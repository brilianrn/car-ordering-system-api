import { globalLogger as Logger } from '@/shared/utils/logger';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { UpdateUserDto } from '../dto';
import { UserRepositoryPort } from '../ports/repository.port';
import { IUpdateUserResponse, UserUsecasePort } from '../ports/usecase.port';

@Injectable()
export class UserUseCase implements UserUsecasePort {
  constructor(
    @Inject('UserRepositoryPort')
    private readonly repository: UserRepositoryPort,
  ) {
    this.repository = repository;
  }

  async updateUser(employeeId: string, dto: UpdateUserDto): Promise<IUsecaseResponse<IUpdateUserResponse>> {
    try {
      // 1. Check if employee exists
      const employee = await this.repository.findEmployeeById(employeeId);
      if (!employee) {
        return {
          error: {
            message: 'Employee not found',
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // 2. Validate supervisor exists if provided
      if (dto.approverL1Id) {
        const supervisor = await this.repository.findEmployeeById(dto.approverL1Id);
        if (!supervisor) {
          return {
            error: {
              message: 'Supervisor not found',
              code: HttpStatus.BAD_REQUEST,
            },
          };
        }
      }

      // 3. Update employee
      await this.repository.updateEmployee(employeeId, {
        roles: dto.roles,
        approverL1Id: dto.approverL1Id,
        orgUnitId: dto.orgUnitId,
      });

      Logger.info(`Employee ${employeeId} updated successfully`, 'UserUseCase.updateUser');

      return {
        data: {
          message: 'User updated successfully',
          employeeId,
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error during user update',
        error instanceof Error ? error.stack : undefined,
        'UserUseCase.updateUser',
      );
      return {
        error: {
          message: 'An error occurred while updating user',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }
}
