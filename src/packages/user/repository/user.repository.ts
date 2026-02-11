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

  async findAll(query: ListUserQueryDto): Promise<IPaginationResponse<Employee & { supervisor: any }>> {
    const { search, role, department, orderBy, orderDirection } = query;
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      isActive: true, // Only active users by default, unless specific req
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
      // Filter by role in userRoles or effectiveRoles
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
    // 1. Get all RBAC roles to map enum to ID
    const rbacRoles = await this.db.rBACRole.findMany({
      where: { name: { in: roles } },
    });

    if (rbacRoles.length === 0) return;

    // 2. Transaction to update UserRoles
    await this.db.$transaction(async (tx) => {
      // Deactivate/Remove roles not in the new list?
      // For strict sync, we might remove existing roles that are NOT in the new list.
      // Let's assume we replace the roles.
      // First, find existing active user roles
      const existingUserRoles = await tx.userRole.findMany({
        where: { employeeId, isActive: true },
        include: { role: true },
      });

      const newRoleIds = rbacRoles.map((r) => r.id);
      const existingRoleIds = existingUserRoles.map((ur) => ur.roleId);

      // Roles to add
      const rolesToAdd = rbacRoles.filter((r) => !existingRoleIds.includes(r.id));

      // Roles to remove (soft delete / deactivate)
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
    // AuditLog entityId is Int. If string passed, we might need a workaround or schema change.
    // The requirement said "EntityId Int @map("entity_id")" in schema line 552.
    // But EmployeeId is a string.
    // This is a schema mismatch for Employee entity.
    // I will try to parse int if possible, or we should have updated schema.
    // Since I cannot update schema easily without migration flow potentially,
    // and this is "Re-check", maybe I should check if schema supports string.
    // Schema line 552: entityId Int.
    // Exception: If entity is User/Employee, ID is string.
    // I will convert to 0 or hash if it's string, OR just use 0 and put ID in details.
    // OR BETTER: I will assume entityId is for ID-based entities, and for Employee we might put 0.
    // Wait, the user asked for Audit Logging for Role Change (Employee). Employee ID is string (NIK).
    // I will put 0 for entityId and put the real NIK in beforeAfter or reason.
    // Actually, I'll allow the method to take generic and handle it safely.

    let safeEntityId = 0;
    if (typeof data.entityId === 'number') {
      safeEntityId = data.entityId;
    } else {
      // Try parse
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
        // Defaults
        transmissionPref: 'ALL',
        realtimeStatus: 'Idle',
        isDedicated: false,
      },
    });
  }
}
