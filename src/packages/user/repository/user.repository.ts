import { clientDb } from '@/shared/utils';
import { Injectable } from '@nestjs/common';
import { Employee, PrismaClient, Role } from '@prisma/client';
import { UserRepositoryPort } from '../ports/repository.port';

@Injectable()
export class UserRepository implements UserRepositoryPort {
  private readonly db: PrismaClient = clientDb;

  async findEmployeeById(employeeId: string): Promise<(Employee & { orgUnit: any }) | null> {
    try {
      return await this.db.employee.findUnique({
        where: { employeeId },
        include: {
          orgUnit: true,
        },
      });
    } catch (error) {
      return null;
    }
  }

  async updateEmployee(
    employeeId: string,
    data: {
      roles?: Role[];
      approverL1Id?: string;
      orgUnitId?: number;
    },
  ): Promise<Employee> {
    const updateData: any = {
      updatedBy: 'SYSTEM', // TODO: Get from JWT context
    };

    if (data.roles !== undefined) {
      updateData.effectiveRoles = data.roles;
    }

    if (data.approverL1Id !== undefined) {
      updateData.approverL1Id = data.approverL1Id;
    }

    if (data.orgUnitId !== undefined) {
      updateData.orgUnitId = data.orgUnitId;
    }

    return this.db.employee.update({
      where: { employeeId },
      data: updateData,
    });
  }
}
