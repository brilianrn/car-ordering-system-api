import { Role } from '@prisma/client';
import { TempRoleStatus } from '../domain/types';

export class RoleInfoDto {
  id: string;
  name: Role;
  displayName: string;
  description?: string;
  level: number;
  isActive: boolean;
  permissions?: PermissionDto[];
}

export class PermissionDto {
  id: string;
  module: string;
  action: string;
  resource?: string;
  description?: string;
}

export class UserRoleAssignmentDto {
  id: string;
  roleId: string;
  role: RoleInfoDto;
  assignedBy: string;
  assignedAt: Date;
  expiresAt?: Date;
  reason?: string;
  isActive: boolean;
}

export class TempRoleAssignmentDto {
  id: string;
  roleId: string;
  role: RoleInfoDto;
  reason: string;
  tempRoleEnd: Date;
  assignedBy: string;
  assignedAt: Date;
  status: TempRoleStatus;
}

export class RLSFilterDto {
  id: string;
  filterType: string;
  filterKey: string;
  filterValue: string;
}

export class CalculateRolesResponseDto {
  employeeId: string;
  effectiveRoles: Role[];
  permissions: PermissionDto[];
  rlsFilters: RLSFilterDto[];
  sodViolations: SoDRuleInfoDto[];
  roleMatrixVersion: string;
}

export class UserRBACInfoDto {
  employeeId: string;
  currentRoles: UserRoleAssignmentDto[];
  tempRoles: TempRoleAssignmentDto[];
  effectiveRoles: Role[];
  effectivePermissions: PermissionDto[];
  rlsFilters: RLSFilterDto[];
  lastCalculated: Date;
  roleMatrixVersion: string;
}

export class SoDRuleInfoDto {
  id: string;
  name: string;
  description?: string;
  primaryRole: RoleInfoDto;
  conflictingRole: RoleInfoDto;
  isActive: boolean;
}
