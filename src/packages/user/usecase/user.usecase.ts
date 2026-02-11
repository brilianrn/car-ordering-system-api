import { globalLogger as Logger } from '@/shared/utils/logger';
import { IPaginationResponse, IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Employee } from '@prisma/client';
import { ListUserQueryDto } from '../dto/list-user-query.dto';
import { UpdateRolesDto } from '../dto/update-roles.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserRepositoryPort } from '../ports/repository.port';
import { IUpdateUserResponse, UserUsecasePort } from '../ports/usecase.port';

@Injectable()
export class UserUseCase implements UserUsecasePort {
  constructor(
    @Inject('UserRepositoryPort')
    private readonly repository: UserRepositoryPort,
  ) {}

  async findAll(query: ListUserQueryDto): Promise<IUsecaseResponse<IPaginationResponse<Employee>>> {
    try {
      const result = await this.repository.findAll(query);
      return { data: result };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error during findAll',
        error instanceof Error ? error.stack : undefined,
        'UserUseCase.findAll',
      );
      return {
        error: {
          message: 'An error occurred while fetching users',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }

  async findOne(employeeId: string): Promise<IUsecaseResponse<Employee>> {
    try {
      const employee = await this.repository.findEmployeeById(employeeId);
      if (!employee) {
        return {
          error: {
            message: 'User not found',
            code: HttpStatus.NOT_FOUND,
          },
        };
      }
      return { data: employee };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error during findOne',
        error instanceof Error ? error.stack : undefined,
        'UserUseCase.findOne',
      );
      return {
        error: {
          message: 'An error occurred while fetching user',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
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

  async updateRoles(
    employeeId: string,
    dto: UpdateRolesDto,
    actorId: string,
  ): Promise<IUsecaseResponse<IUpdateUserResponse>> {
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

      // 2. Check for Driver Role Logic
      if (dto.roles.includes('DRIVER')) {
        // If employee doesn't have a driver profile, we need to create one
        if (!employee.driverProfile) {
          await this.repository.createDriverProfile({
            employeeId: employee.employeeId,
            fullName: employee.fullName,
            driverCode: `DRV-${employee.employeeId}`,
            simNumber: employee.employeeId, // Default to NIK/EmployeeID as per requirement or convention if no data
            simExpiry: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // 1 year default
            plantLocation: employee.orgUnit?.name || 'Head Office', // Default to OrgUnit or Head Office
            createdBy: actorId,
          });
          Logger.info(`Auto-created driver profile for ${employeeId}`, 'UserUseCase.updateRoles');
        }
      }

      // 3. Update Roles (Sync UserRole + Employee.effectiveRoles)
      await this.repository.updateEmployee(employeeId, { roles: dto.roles });
      await this.repository.upsertUserRoles(employeeId, dto.roles, actorId);

      // 4. Audit Log
      await this.repository.createAuditLog({
        userNik: actorId, // Who changed it
        featureCode: 'USER_MANAGEMENT',
        action: 'UPDATE_ROLES',
        entityType: 'EMPLOYEE',
        entityId: employeeId, // Passing string NIK/ID
        beforeAfter: {
          roles_before: employee.effectiveRoles,
          roles_after: dto.roles,
        },
        reasonCode: 'MANUAL_UPDATE',
      });

      return {
        data: {
          message: 'User roles updated successfully',
          employeeId,
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error during role update',
        error instanceof Error ? error.stack : undefined,
        'UserUseCase.updateRoles',
      );
      return {
        error: {
          message: 'An error occurred while updating roles',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }

  async remove(employeeId: string, actorId: string): Promise<IUsecaseResponse<void>> {
    try {
      const employee = await this.repository.findEmployeeById(employeeId);
      if (!employee) {
        return {
          error: {
            message: 'Employee not found',
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      await this.repository.softDelete(employeeId, actorId);

      await this.repository.createAuditLog({
        userNik: actorId,
        featureCode: 'USER_MANAGEMENT',
        action: 'DELETE_USER',
        entityType: 'EMPLOYEE',
        entityId: employeeId,
        reasonCode: 'MANUAL_DELETE',
      });

      return {
        data: undefined,
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error during user deletion',
        error instanceof Error ? error.stack : undefined,
        'UserUseCase.remove',
      );
      return {
        error: {
          message: 'An error occurred while deleting user',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }
}
