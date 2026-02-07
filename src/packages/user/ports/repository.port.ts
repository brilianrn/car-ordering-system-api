import { Employee, Role } from '@prisma/client';

export interface UserRepositoryPort {
  findEmployeeById(employeeId: string): Promise<(Employee & { orgUnit: any }) | null>;

  updateEmployee(
    employeeId: string,
    data: {
      roles?: Role[];
      approverL1Id?: string;
      orgUnitId?: number;
    },
  ): Promise<Employee>;
}
