import { IPaginationResponse } from '@/shared/utils/rest-api/types';
import { Employee, Role } from '@prisma/client';
import { ListUserQueryDto } from '../dto/list-user-query.dto';

export interface UserRepositoryPort {
  findAll(query: ListUserQueryDto): Promise<IPaginationResponse<Employee & { supervisor: any }>>;
  findEmployeeById(
    employeeId: string,
  ): Promise<(Employee & { orgUnit: any; userRoles: any[]; driverProfile: any; supervisor: any }) | null>;
  softDelete(employeeId: string, deletedBy: string): Promise<boolean>;

  updateEmployee(
    employeeId: string,
    data: {
      roles?: Role[];
      approverL1Id?: string;
      orgUnitId?: number;
    },
  ): Promise<Employee>;

  upsertUserRoles(employeeId: string, roles: Role[], assignedBy: string): Promise<void>;
  createAuditLog(data: {
    userNik: string;
    featureCode: string;
    action: string;
    entityType: string;
    entityId: number | string; // Entity ID can be int or string (uuid)
    beforeAfter?: any;
    reasonCode?: string;
  }): Promise<void>;

  createDriverProfile(data: {
    employeeId: string;
    fullName: string;
    driverCode: string;
    simNumber: string;
    simExpiry: Date;
    plantLocation: string;
    createdBy: string;
  }): Promise<void>;
}
