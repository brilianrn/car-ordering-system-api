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
    entityId: number | string;
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

  // ─── Sync-specific methods ────────────────────────────────────────────────────

  /** Find or create an OrganizationUnit by code. Returns its numeric `id`. */
  upsertOrganizationUnit(code: string, createdBy: string): Promise<number>;

  /** Upsert an Employee record. Returns { isNew: boolean }. */
  upsertEmployee(data: {
    employeeId: string;
    fullName: string;
    email: string;
    orgUnitId: number;
    isActive: boolean;
    position?: string | null;
    jobFamily?: string | null;
    immediateSupervisor?: string | null;
    immediateManager?: string | null;
    userType?: string | null;
    createdBy: string;
  }): Promise<{ isNew: boolean }>;

  /** Upsert an Account linked to an Employee. Returns { isNew: boolean }. */
  upsertAccount(data: { employeeId: string; email: string; hashedPassword: string }): Promise<{ isNew: boolean }>;

  /** Ensure the employee has the USER role. Creates UserRole if missing. */
  ensureUserRole(employeeId: string, assignedBy: string): Promise<void>;

  // ─── SyncBatch lifecycle ─────────────────────────────────────────────────────

  createSyncBatch(data: { runType: 'MANUAL' | 'FULL' | 'DELTA'; createdBy: string }): Promise<string>; // returns batchId

  updateSyncBatch(
    batchId: string,
    data: {
      status: 'DONE' | 'FAIL' | 'RUNNING';
      endTime?: Date;
      totalRecords?: number;
      processedRecords?: number;
      insertedRecords?: number;
      updatedRecords?: number;
      errorRecords?: number;
      errorDetails?: string[];
      updatedBy?: string;
    },
  ): Promise<void>;
}
