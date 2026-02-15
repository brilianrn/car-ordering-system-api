import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { Injectable } from '@nestjs/common';
import { PrismaClient, Role } from '@prisma/client';
import { IEmployeeSearchResponse } from '../domain/response';
import { EmployeesUsecasePort } from '../ports/usecase.port';

@Injectable()
export class EmployeesUseCase implements EmployeesUsecasePort {
  private readonly db: PrismaClient = clientDb;

  search = async (query: string, roles?: string[]): Promise<IUsecaseResponse<IEmployeeSearchResponse[]>> => {
    try {
      if (!query || query.length < 3) {
        return { data: [] };
      }

      const employees = await this.db.employee.findMany({
        where: {
          AND: [
            {
              OR: [
                { fullName: { contains: query, mode: 'insensitive' } },
                { employeeId: { contains: query, mode: 'insensitive' } },
              ],
            },
            {
              driverProfile: null, // Exclude employees who are already drivers
            },
            {
              isActive: true,
            },
            ...(roles && roles.length > 0
              ? [
                  {
                    effectiveRoles: {
                      hasSome: roles as Role[],
                    },
                  },
                ]
              : []),
          ],
        },
        select: {
          employeeId: true,
          fullName: true,
          email: true,
          orgUnit: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        take: 20,
      });

      const result: IEmployeeSearchResponse[] = employees.map((emp) => ({
        employeeId: emp.employeeId,
        fullName: emp.fullName,
        email: emp.email,
        orgUnit: {
          id: emp.orgUnit.id,
          code: emp.orgUnit.code,
          name: emp.orgUnit.name,
        },
      }));

      return { data: result };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in search',
        error instanceof Error ? error.stack : undefined,
        'EmployeesUseCase.search',
      );
      return {
        error: {
          message: 'Failed to search employees',
          code: 500,
        },
      };
    }
  };
}
