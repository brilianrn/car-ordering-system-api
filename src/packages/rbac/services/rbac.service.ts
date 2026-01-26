import { Injectable, Logger, Inject } from '@nestjs/common';
import { Role } from '@prisma/client';
import { clientDb } from '../../../shared/utils';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import {
  RoleInfo,
  Permission,
  UserRoleAssignment,
  TempRoleAssignment,
  CalculateRolesRequest,
  CalculateRolesResponse,
  AssignTempRoleRequest,
  RevokeTempRoleRequest,
  UserRBACInfo,
  RoleCalculationResult,
  PermissionHash,
  RBACValidationResult,
  RBACError,
  RoleCalculationError,
  SoDViolationError,
  TempRoleExpiredError,
  SYSTEM_ROLES,
  DEFAULT_ROLE_LEVELS,
  AUDIT_RETENTION_YEARS,
  TempRoleStatus,
} from '../domain/types';

@Injectable()
export class RBACService {
  private readonly logger = new Logger(RBACService.name);
  private readonly db: PrismaClient = clientDb;

  /**
   * Calculate effective roles and permissions for an employee
   */
  async calculateEffectiveRoles(request: CalculateRolesRequest): Promise<CalculateRolesResponse> {
    try {
      this.logger.log(`Calculating roles for employee ${request.employeeId}`);

      // Get active role matrix
      const activeMatrix = await this.getActiveRoleMatrix();
      if (!activeMatrix) {
        throw new RBACError('No active role matrix found', 'NO_ACTIVE_MATRIX');
      }

      // Calculate roles based on HRIS attributes
      const calculationResult = await this.calculateRolesFromMatrix(request.hrisAttributes, activeMatrix.id);

      // Validate SoD rules
      const sodViolations = await this.validateSoDRules(request.employeeId, calculationResult.roles);

      // Generate RLS filters
      const rlsFilters = await this.generateRLSFilters(request.employeeId, calculationResult.roles);

      // Get permissions for calculated roles
      const permissions = await this.getPermissionsForRoles(calculationResult.roles);

      return {
        employeeId: request.employeeId,
        effectiveRoles: calculationResult.roles,
        permissions,
        rlsFilters,
        sodViolations,
        roleMatrixVersion: activeMatrix.version,
      };
    } catch (error) {
      this.logger.error(`Failed to calculate roles for ${request.employeeId}: ${error.message}`, error.stack);
      throw error instanceof RBACError ? error : new RoleCalculationError(request.employeeId, error.message);
    }
  }

  /**
   * Get complete RBAC information for a user
   */
  async getUserRBACInfo(employeeId: string): Promise<UserRBACInfo> {
    const [currentRoles, tempRoles, calculation] = await Promise.all([
      this.getUserCurrentRoles(employeeId),
      this.getUserTempRoles(employeeId),
      this.calculateEffectiveRoles({ employeeId, hrisAttributes: {} }),
    ]);

    return {
      employeeId,
      currentRoles,
      tempRoles,
      effectiveRoles: calculation.effectiveRoles,
      effectivePermissions: calculation.permissions,
      rlsFilters: calculation.rlsFilters,
      lastCalculated: new Date(),
      roleMatrixVersion: calculation.roleMatrixVersion,
    };
  }

  /**
   * Assign temporary role to user
   */
  async assignTempRole(request: AssignTempRoleRequest, assignedBy: string): Promise<TempRoleAssignment> {
    try {
      // Validate temp role doesn't exceed reasonable duration (max 30 days)
      const maxDuration = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
      const duration = request.tempRoleEnd.getTime() - Date.now();

      if (duration > maxDuration) {
        throw new RBACError('Temporary role duration cannot exceed 30 days', 'INVALID_TEMP_ROLE_DURATION');
      }

      // Check if user already has this role temporarily
      const existingTempRole = await this.db.tempRole.findFirst({
        where: {
          employeeId: request.employeeId,
          roleId: request.roleId,
          status: TempRoleStatus.ACTIVE,
        },
      });

      if (existingTempRole) {
        throw new RBACError('User already has this role temporarily assigned', 'DUPLICATE_TEMP_ROLE');
      }

      // Create temp role
      const tempRole = await this.db.tempRole.create({
        data: {
          employeeId: request.employeeId,
          roleId: request.roleId,
          reason: request.reason,
          tempRoleEnd: request.tempRoleEnd,
          assignedBy,
        },
        include: {
          role: true,
        },
      });

      // Create audit snapshot
      await this.createAuditSnapshot({
        employeeId: request.employeeId,
        snapshotType: 'TEMP_ROLE',
        action: 'GRANT',
        changeReason: `Temporary role assigned: ${request.reason}`,
        changedBy: assignedBy,
        tempRoleInfo: tempRole,
      });

      this.logger.log(
        `Temporary role ${request.roleId} assigned to ${request.employeeId} until ${request.tempRoleEnd.toISOString()}`,
      );

      return this.mapTempRoleToDomain(tempRole);
    } catch (error) {
      this.logger.error(`Failed to assign temp role: ${error.message}`, error.stack);
      throw error instanceof RBACError
        ? error
        : new RBACError(`Failed to assign temp role: ${error.message}`, 'TEMP_ROLE_ASSIGN_FAILED');
    }
  }

  /**
   * Revoke temporary role
   */
  async revokeTempRole(request: RevokeTempRoleRequest, revokedBy: string): Promise<void> {
    try {
      const tempRole = await this.db.tempRole.findUnique({
        where: { id: request.tempRoleId },
        include: { role: true },
      });

      if (!tempRole) {
        throw new RBACError('Temporary role not found', 'TEMP_ROLE_NOT_FOUND');
      }

      if (tempRole.status !== TempRoleStatus.ACTIVE) {
        throw new TempRoleExpiredError(request.tempRoleId);
      }

      // Update temp role status
      await this.db.tempRole.update({
        where: { id: request.tempRoleId },
        data: {
          status: TempRoleStatus.REVOKED,
          revokedAt: new Date(),
          revokedBy,
          revokeReason: request.revokeReason,
        },
      });

      // Create audit snapshot
      await this.createAuditSnapshot({
        employeeId: tempRole.employeeId,
        snapshotType: 'TEMP_ROLE',
        action: 'REVOKE',
        changeReason: `Temporary role revoked: ${request.revokeReason}`,
        changedBy: revokedBy,
        tempRoleInfo: tempRole,
      });

      this.logger.log(`Temporary role ${request.tempRoleId} revoked for ${tempRole.employeeId}`);
    } catch (error) {
      this.logger.error(`Failed to revoke temp role: ${error.message}`, error.stack);
      throw error instanceof RBACError
        ? error
        : new RBACError(`Failed to revoke temp role: ${error.message}`, 'TEMP_ROLE_REVOKE_FAILED');
    }
  }

  /**
   * Clean up expired temporary roles
   */
  async cleanupExpiredTempRoles(): Promise<number> {
    try {
      const expiredRoles = await this.db.tempRole.updateMany({
        where: {
          status: TempRoleStatus.ACTIVE,
          tempRoleEnd: {
            lt: new Date(),
          },
        },
        data: {
          status: TempRoleStatus.EXPIRED,
          revokedAt: new Date(),
          revokeReason: 'Automatically expired',
        },
      });

      if (expiredRoles.count > 0) {
        this.logger.log(`Cleaned up ${expiredRoles.count} expired temporary roles`);
      }

      return expiredRoles.count;
    } catch (error) {
      this.logger.error(`Failed to cleanup expired temp roles: ${error.message}`, error.stack);
      throw new RBACError(`Failed to cleanup expired temp roles: ${error.message}`, 'CLEANUP_FAILED');
    }
  }

  /**
   * Validate if role assignment would violate SoD rules
   */
  async validateRoleAssignment(employeeId: string, newRoles: Role[]): Promise<RBACValidationResult> {
    try {
      const sodViolations = await this.validateSoDRules(employeeId, newRoles);

      return {
        isValid: sodViolations.length === 0,
        errors: sodViolations.map(
          (v) => `SoD violation: ${v.role.name} cannot be combined with ${v.conflictingRole.name}`,
        ),
        warnings: [],
        sodViolations,
      };
    } catch (error) {
      this.logger.error(`Failed to validate role assignment: ${error.message}`, error.stack);
      return {
        isValid: false,
        errors: [`Validation failed: ${error.message}`],
        warnings: [],
        sodViolations: [],
      };
    }
  }

  // ==================== PRIVATE METHODS ====================

  private async getActiveRoleMatrix() {
    return await this.db.roleMatrix.findFirst({
      where: {
        status: 'PUBLISHED',
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  private async calculateRolesFromMatrix(
    hrisAttributes: CalculateRolesRequest['hrisAttributes'],
    roleMatrixId: string,
  ): Promise<RoleCalculationResult> {
    const mappings = await this.db.roleMatrixMapping.findMany({
      where: { roleMatrixId },
      include: { role: true },
      orderBy: { priority: 'desc' }, // Higher priority first
    });

    const matchedRoles = new Set<Role>();
    const matchedMappings: any[] = [];

    for (const mapping of mappings) {
      if (this.matchesHRISAttributes(hrisAttributes, mapping)) {
        // Convert string role name to Role enum
        const roleName = mapping.role.name as Role;
        if (!matchedRoles.has(roleName)) {
          matchedRoles.add(roleName);
          matchedMappings.push(mapping);
        }
      }
    }

    // Ensure at least USER role
    if (matchedRoles.size === 0) {
      matchedRoles.add(SYSTEM_ROLES.USER);
    }

    const roles = Array.from(matchedRoles);
    const permissions = await this.getPermissionsForRoles(roles);
    const rlsFilters = await this.generateRLSFiltersFromRoles(roles, hrisAttributes);

    return {
      roles,
      permissions,
      rlsFilters,
      sodViolations: [], // Will be validated separately
      matchedMappings,
    };
  }

  private matchesHRISAttributes(attributes: CalculateRolesRequest['hrisAttributes'], mapping: any): boolean {
    // Check exact matches
    if (mapping.orgUnitCode && attributes.organizationUnit !== mapping.orgUnitCode) {
      return false;
    }

    if (mapping.division && attributes.division !== mapping.division) {
      return false;
    }

    if (mapping.department && attributes.department !== mapping.department) {
      return false;
    }

    if (mapping.costCenter && attributes.costCenter !== mapping.costCenter) {
      return false;
    }

    if (mapping.position && attributes.position !== mapping.position) {
      return false;
    }

    if (mapping.jobFamily && attributes.jobFamily !== mapping.jobFamily) {
      return false;
    }

    // Check pattern matches
    if (mapping.orgUnitPattern && !new RegExp(mapping.orgUnitPattern).test(attributes.organizationUnit || '')) {
      return false;
    }

    if (mapping.positionPattern && !new RegExp(mapping.positionPattern).test(attributes.position || '')) {
      return false;
    }

    if (mapping.jobFamilyPattern && !new RegExp(mapping.jobFamilyPattern).test(attributes.jobFamily || '')) {
      return false;
    }

    return true;
  }

  private async validateSoDRules(employeeId: string, roles: Role[]): Promise<Array<{
    id: string;
    name: string;
    description?: string;
    role: any;
    conflictingRole: any;
    isActive: boolean;
  }>> {
    const violations: Array<{
      id: string;
      name: string;
      description?: string;
      role: any;
      conflictingRole: any;
      isActive: boolean;
    }> = [];

    for (const role of roles) {
      const sodRules = await this.db.soDRule.findMany({
        where: {
          OR: [{ roleId: role }, { conflictingRoleId: role }],
          isActive: true,
        },
        include: {
          role: true,
          conflictingRole: true,
        },
      });

      for (const rule of sodRules) {
        const conflictingRole = rule.roleId === role ? rule.conflictingRoleId : rule.roleId;

        if (roles.includes(conflictingRole as Role)) {
          violations.push({
            id: rule.id,
            name: rule.name,
            description: rule.description || undefined,
            role: rule.role,
            conflictingRole: rule.conflictingRole,
            isActive: rule.isActive,
          });
        }
      }
    }

    return violations;
  }

  private async getPermissionsForRoles(roles: Role[]): Promise<Permission[]> {
    const rolePermissions = await this.db.rolePermission.findMany({
      where: {
        roleId: {
          in: roles.map((r) => r.toString()),
        },
      },
      include: {
        permission: true,
      },
    });

    return rolePermissions.map((rp) => ({
      id: rp.permission.id,
      module: rp.permission.module,
      action: rp.permission.action,
      resource: rp.permission.resource || undefined,
      description: rp.permission.description || undefined,
    }));
  }

  private async generateRLSFilters(employeeId: string, roles: Role[]): Promise<any[]> {
    // Clear existing filters
    await this.db.rLSFilter.deleteMany({
      where: { employeeId },
    });

    // Get employee org unit info
    const employee = await this.db.employee.findUnique({
      where: { employeeId },
      include: { orgUnit: true },
    });

    if (!employee) {
      return [];
    }

    const filters: any[] = [];

    // Add org unit filter
    if (employee.orgUnit) {
      filters.push({
        employeeId,
        filterType: 'org_unit',
        filterKey: 'org_unit_id',
        filterValue: employee.orgUnit.id.toString(),
        createdBy: 'SYSTEM',
      });
    }

    // Add plant filter based on org unit
    if (employee.orgUnit?.code) {
      // Extract plant code from org unit (assuming format like "PLANT001-...")
      const plantMatch = employee.orgUnit.code.match(/^([^-]+)/);
      if (plantMatch) {
        filters.push({
          employeeId,
          filterType: 'plant',
          filterKey: 'plant_code',
          filterValue: plantMatch[1],
          createdBy: 'SYSTEM',
        });
      }
    }

    // Create filters in database
    if (filters.length > 0) {
      await this.db.rLSFilter.createMany({ data: filters });
    }

    return filters;
  }

  private async generateRLSFiltersFromRoles(roles: Role[], hrisAttributes: any): Promise<any[]> {
    const filters: any[] = [];

    // Basic org unit filter
    if (hrisAttributes.organizationUnit) {
      filters.push({
        filterType: 'org_unit',
        filterKey: 'org_unit_code',
        filterValue: hrisAttributes.organizationUnit,
      });
    }

    // Plant filter
    if (hrisAttributes.organizationUnit) {
      const plantMatch = hrisAttributes.organizationUnit.match(/^([^-]+)/);
      if (plantMatch) {
        filters.push({
          filterType: 'plant',
          filterKey: 'plant_code',
          filterValue: plantMatch[1],
        });
      }
    }

    return filters;
  }

  private async getUserCurrentRoles(employeeId: string): Promise<UserRoleAssignment[]> {
    const userRoles = await this.db.userRole.findMany({
      where: {
        employeeId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { role: true },
    });

    return userRoles.map((ur) => this.mapUserRoleToDomain(ur));
  }

  private async getUserTempRoles(employeeId: string): Promise<TempRoleAssignment[]> {
    const tempRoles = await this.db.tempRole.findMany({
      where: {
        employeeId,
        status: TempRoleStatus.ACTIVE,
        tempRoleEnd: { gt: new Date() },
      },
      include: { role: true },
    });

    return tempRoles.map((tr) => this.mapTempRoleToDomain(tr));
  }

  private async createAuditSnapshot(params: {
    employeeId: string;
    snapshotType: string;
    action: string;
    changeReason?: string;
    changedBy: string;
    rolesBefore?: Role[];
    rolesAfter?: Role[];
    tempRoleInfo?: any;
  }): Promise<void> {
    const retainUntil = new Date();
    retainUntil.setFullYear(retainUntil.getFullYear() + AUDIT_RETENTION_YEARS);

    await this.db.rBACSnapshot.create({
      data: {
        employeeId: params.employeeId,
        snapshotType: params.snapshotType,
        action: params.action,
        rolesBefore: params.rolesBefore || undefined,
        rolesAfter: params.rolesAfter || undefined,
        changeReason: params.changeReason,
        changedBy: params.changedBy,
        retainUntil,
      },
    });
  }

  private mapUserRoleToDomain(userRole: any): UserRoleAssignment {
    return {
      id: userRole.id,
      employeeId: userRole.employeeId,
      roleId: userRole.roleId,
      role: {
        id: userRole.role.id,
        name: userRole.role.name,
        displayName: userRole.role.displayName,
        description: userRole.role.description,
        level: userRole.role.level,
        isActive: userRole.role.isActive,
      },
      assignedBy: userRole.assignedBy,
      assignedAt: userRole.assignedAt,
      expiresAt: userRole.expiresAt,
      reason: userRole.reason,
      isActive: userRole.isActive,
    };
  }

  private mapTempRoleToDomain(tempRole: any): TempRoleAssignment {
    return {
      id: tempRole.id,
      employeeId: tempRole.employeeId,
      roleId: tempRole.roleId,
      role: {
        id: tempRole.role.id,
        name: tempRole.role.name,
        displayName: tempRole.role.displayName,
        description: tempRole.role.description,
        level: tempRole.role.level,
        isActive: tempRole.role.isActive,
      },
      reason: tempRole.reason,
      tempRoleEnd: tempRole.tempRoleEnd,
      assignedBy: tempRole.assignedBy,
      assignedAt: tempRole.assignedAt,
      status: tempRole.status,
    };
  }
}
