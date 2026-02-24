import { clientDb } from '@/shared/utils';
import { Pagination } from '@/shared/utils/rest-api/pagination';
import { IPaginationResponse } from '@/shared/utils/rest-api/types';
import { Injectable } from '@nestjs/common';
import { Employee, PrismaClient, Role } from '@prisma/client';
import { ListUserQueryDto } from '../dto/list-user-query.dto';
import { UserRepositoryPort } from '../ports/repository.port';

@Injectable()
export class UserRepository implements UserRepositoryPort {
  private readonly db: PrismaClient = clientDb;

  // ─── Existing Methods ─────────────────────────────────────────────────────────

  async findAll(query: ListUserQueryDto): Promise<IPaginationResponse<Employee & { supervisor: any }>> {
    const { search, role, department, orderBy, orderDirection } = query;
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      isActive: true,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      where.OR = [{ effectiveRoles: { has: role } }, { userRoles: { some: { role: { name: role } } } }];
    }

    if (department) {
      where.orgUnit = {
        name: { contains: department, mode: 'insensitive' },
      };
    }

    const [count, rows] = await Promise.all([
      this.db.employee.count({ where }),
      this.db.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: orderBy ? { [orderBy]: orderDirection || 'asc' } : { createdAt: 'desc' },
        include: {
          orgUnit: true,
          approverL1: true,
          userRoles: {
            include: { role: true },
          },
        },
      }),
    ]);

    const mappedRows = rows.map((row: any) => ({
      ...row,
      supervisor: row.approverL1
        ? {
            employeeId: row.approverL1.employeeId,
            fullName: row.approverL1.fullName,
          }
        : null,
    }));

    return new Pagination(page, limit).paginate({ count, rows: mappedRows as any });
  }

  async findEmployeeById(
    employeeId: string,
  ): Promise<(Employee & { orgUnit: any; userRoles: any[]; driverProfile: any; supervisor: any }) | null> {
    try {
      const employee = (await this.db.employee.findUnique({
        where: { employeeId, deletedAt: null },
        include: {
          orgUnit: true,
          approverL1: true,
          userRoles: {
            include: { role: true },
          },
          driverProfile: true,
        },
      })) as any;

      if (!employee) return null;

      return {
        ...employee,
        supervisor: employee.approverL1
          ? {
              employeeId: employee.approverL1.employeeId,
              fullName: employee.approverL1.fullName,
            }
          : null,
      };
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
      updatedBy: 'SYSTEM',
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

  async softDelete(employeeId: string, deletedBy: string): Promise<boolean> {
    await this.db.employee.update({
      where: { employeeId },
      data: {
        deletedAt: new Date(),
        deletedBy,
        isActive: false,
      },
    });
    return true;
  }

  async upsertUserRoles(employeeId: string, roles: Role[], assignedBy: string): Promise<void> {
    const rbacRoles = await this.db.rBACRole.findMany({
      where: { name: { in: roles } },
    });

    if (rbacRoles.length === 0) return;

    await this.db.$transaction(async (tx) => {
      const existingUserRoles = await tx.userRole.findMany({
        where: { employeeId, isActive: true },
        include: { role: true },
      });

      const newRoleIds = rbacRoles.map((r) => r.id);
      const existingRoleIds = existingUserRoles.map((ur) => ur.roleId);

      const rolesToAdd = rbacRoles.filter((r) => !existingRoleIds.includes(r.id));
      const rolesToRemove = existingUserRoles.filter((ur) => !newRoleIds.includes(ur.roleId));

      for (const role of rolesToAdd) {
        await tx.userRole.create({
          data: {
            employeeId,
            roleId: role.id,
            assignedBy,
            isActive: true,
          },
        });
      }

      for (const userRole of rolesToRemove) {
        await tx.userRole.update({
          where: { id: userRole.id },
          data: {
            isActive: false,
            deactivatedAt: new Date(),
            deactivatedBy: assignedBy,
          },
        });
      }
    });
  }

  async createAuditLog(data: {
    userNik: string;
    featureCode: string;
    action: string;
    entityType: string;
    entityId: number | string;
    beforeAfter?: any;
    reasonCode?: string;
  }): Promise<void> {
    let safeEntityId = 0;
    if (typeof data.entityId === 'number') {
      safeEntityId = data.entityId;
    } else {
      const parsed = parseInt(data.entityId);
      if (!isNaN(parsed)) safeEntityId = parsed;
    }

    await this.db.auditLog.create({
      data: {
        userNik: data.userNik,
        featureCode: data.featureCode,
        action: data.action,
        entityType: data.entityType,
        entityId: safeEntityId,
        beforeAfter: data.beforeAfter ?? {},
        reasonCode: data.reasonCode,
      },
    });
  }

  async createDriverProfile(data: {
    employeeId: string;
    fullName: string;
    driverCode: string;
    simNumber: string;
    simExpiry: Date;
    plantLocation: string;
    createdBy: string;
  }): Promise<void> {
    await this.db.driver.create({
      data: {
        employeeId: data.employeeId,
        fullName: data.fullName,
        driverCode: data.driverCode,
        simNumber: data.simNumber,
        simExpiry: data.simExpiry,
        plantLocation: data.plantLocation,
        createdBy: data.createdBy,
        transmissionPref: 'ALL',
        realtimeStatus: 'Idle',
        isDedicated: false,
      },
    });
  }

  // ─── Sync-specific implementations ───────────────────────────────────────────

  async upsertOrganizationUnit(code: string, createdBy: string): Promise<number> {
    const orgUnit = await this.db.organizationUnit.upsert({
      where: { code },
      create: {
        code,
        name: code, // fallback: use code as name; can be updated later
        type: 'DEPARTMENT',
        createdBy,
        updatedBy: createdBy,
      },
      update: {}, // do not overwrite existing data
      select: { id: true },
    });
    return orgUnit.id;
  }

  async upsertEmployee(data: {
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
  }): Promise<{ isNew: boolean }> {
    const existing = await this.db.employee.findUnique({
      where: { employeeId: data.employeeId },
      select: { id: true },
    });

    await this.db.employee.upsert({
      where: { employeeId: data.employeeId },
      create: {
        employeeId: data.employeeId,
        fullName: data.fullName,
        email: data.email,
        orgUnitId: data.orgUnitId,
        effectiveFrom: new Date(),
        isActive: data.isActive,
        position: data.position ?? null,
        jobFamily: data.jobFamily ?? null,
        immediateSupervisor: data.immediateSupervisor ?? null,
        immediateManager: data.immediateManager ?? null,
        userType: data.userType ?? null,
        createdBy: data.createdBy,
        updatedBy: data.createdBy,
      },
      update: {
        fullName: data.fullName,
        orgUnitId: data.orgUnitId,
        isActive: data.isActive,
        position: data.position ?? null,
        jobFamily: data.jobFamily ?? null,
        immediateSupervisor: data.immediateSupervisor ?? null,
        immediateManager: data.immediateManager ?? null,
        userType: data.userType ?? null,
        updatedBy: data.createdBy,
      },
    });

    return { isNew: !existing };
  }

  async upsertAccount(data: {
    employeeId: string;
    email: string;
    hashedPassword: string;
  }): Promise<{ isNew: boolean }> {
    const existing = await this.db.account.findUnique({
      where: { employeeId: data.employeeId },
      select: { id: true },
    });

    if (!existing) {
      await this.db.account.create({
        data: {
          email: data.email,
          password: data.hashedPassword,
          employeeId: data.employeeId,
          isVerified: false,
        },
      });
      return { isNew: true };
    }

    // Account exists — do not overwrite password
    return { isNew: false };
  }

  async ensureUserRole(employeeId: string, assignedBy: string): Promise<void> {
    // Find the USER role in RBAC
    const rbacUserRole = await this.db.rBACRole.findFirst({
      where: { name: 'USER' },
      select: { id: true },
    });

    if (!rbacUserRole) return;

    // Check if already has an active USER user-role link
    const existing = await this.db.userRole.findFirst({
      where: {
        employeeId,
        roleId: rbacUserRole.id,
        isActive: true,
      },
    });

    if (!existing) {
      await this.db.userRole.create({
        data: {
          employeeId,
          roleId: rbacUserRole.id,
          assignedBy,
          isActive: true,
        },
      });

      // Also keep effectiveRoles in sync
      await this.db.employee.update({
        where: { employeeId },
        data: {
          effectiveRoles: { push: Role.USER },
        },
      });
    }
  }

  async createSyncBatch(data: { runType: 'MANUAL' | 'FULL' | 'DELTA'; createdBy: string }): Promise<string> {
    const batch = await this.db.syncBatch.create({
      data: {
        runType: data.runType,
        status: 'RUNNING',
        createdBy: data.createdBy,
      },
      select: { id: true },
    });
    return batch.id;
  }

  async updateSyncBatch(
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
  ): Promise<void> {
    await this.db.syncBatch.update({
      where: { id: batchId },
      data: {
        status: data.status,
        endTime: data.endTime,
        totalRecords: data.totalRecords,
        processedRecords: data.processedRecords,
        insertedRecords: data.insertedRecords,
        updatedRecords: data.updatedRecords,
        errorRecords: data.errorRecords,
        errorDetails: data.errorDetails ?? [],
        updatedBy: data.updatedBy,
      },
    });
  }
}
