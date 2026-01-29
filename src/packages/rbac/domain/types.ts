import { Role } from '@prisma/client';

// Re-export Prisma enums for convenience
export { Role };

// Define enums that don't exist in Prisma yet (will be added after migration)
export enum TempRoleStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

export enum RBACStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  RETIRED = 'RETIRED',
  REVOKED = 'REVOKED',
}

export enum PolicyChangeAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  PUBLISH = 'PUBLISH',
  RETIRE = 'RETIRE',
  REVOKE = 'REVOKE',
}

// ===========================================
// Domain Types for RBAC System
// ===========================================

export interface Permission {
  id: string;
  module: string;
  action: string;
  resource?: string;
  description?: string;
}

export interface RoleInfo {
  id: string;
  name: Role;
  displayName: string;
  description?: string;
  level: number;
  isActive: boolean;
  permissions?: Permission[];
}

export interface UserRoleAssignment {
  id: string;
  employeeId: string;
  roleId: string;
  role: RoleInfo;
  assignedBy: string;
  assignedAt: Date;
  expiresAt?: Date;
  reason?: string;
  isActive: boolean;
}

export interface TempRoleAssignment {
  id: string;
  employeeId: string;
  roleId: string;
  role: RoleInfo;
  reason: string;
  tempRoleEnd: Date;
  assignedBy: string;
  assignedAt: Date;
  status: TempRoleStatus;
}

export interface RoleMatrixInfo {
  id: string;
  version: string;
  name: string;
  description?: string;
  status: RBACStatus;
  permissionHash: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  editorId?: string;
  reviewerId?: string;
  reviewedAt?: Date;
}

export interface RoleMatrixMapping {
  id: string;
  roleId: string;
  role: RoleInfo;

  // Matching criteria
  orgUnitCode?: string;
  orgUnitPattern?: string;
  division?: string;
  department?: string;
  costCenter?: string;
  position?: string;
  positionPattern?: string;
  jobFamily?: string;
  jobFamilyPattern?: string;

  priority: number;
}

export interface SoDRuleInfo {
  id: string;
  name: string;
  description?: string;
  role: RoleInfo;
  conflictingRole: RoleInfo;
  isActive: boolean;
}

export interface RLSFilter {
  id: string;
  employeeId: string;
  filterType: string;
  filterKey: string;
  filterValue: string;
}

export interface RBACSnapshot {
  id: string;
  employeeId: string;
  snapshotType: string;
  action: string;
  rolesBefore?: Role[];
  rolesAfter?: Role[];
  permissionsBefore?: Permission[];
  permissionsAfter?: Permission[];
  changeReason?: string;
  changedBy: string;
  changedAt: Date;
  policyVersion?: string;
  policyChangeAction?: PolicyChangeAction;
  retainUntil: Date;
}

// ===========================================
// Request/Response Types
// ===========================================

export interface CalculateRolesRequest {
  employeeId: string;
  hrisAttributes: {
    organizationUnit?: string;
    division?: string;
    department?: string;
    costCenter?: string;
    position?: string;
    jobFamily?: string;
    immediateSupervisor?: string;
    immediateManager?: string;
  };
}

export interface CalculateRolesResponse {
  employeeId: string;
  effectiveRoles: Role[];
  permissions: Permission[];
  rlsFilters: RLSFilter[];
  sodViolations: SoDRuleInfo[];
  roleMatrixVersion: string;
}

export interface AssignTempRoleRequest {
  employeeId: string;
  roleId: string;
  reason: string;
  tempRoleEnd: Date;
}

export interface CreateSoDRuleRequest {
  name: string;
  description?: string;
  primaryRoleId: string;
  conflictingRoleId: string;
}

export interface RevokeTempRoleRequest {
  tempRoleId: string;
  revokeReason: string;
}

export interface CreateRoleMatrixRequest {
  version: string;
  name: string;
  description?: string;
  mappings: Omit<RoleMatrixMapping, 'id' | 'roleMatrixId' | 'role' | 'createdAt' | 'createdBy'>[];
  effectiveFrom: Date;
  effectiveTo?: Date;
}

export interface PublishRoleMatrixRequest {
  roleMatrixId: string;
  reviewerId: string;
}

export interface UserRBACInfo {
  employeeId: string;
  fullName: string;
  lastLogin?: Date;
  currentRoles: UserRoleAssignment[];
  tempRoles: TempRoleAssignment[];
  effectiveRoles: Role[];
  effectivePermissions: Permission[];
  rlsFilters: RLSFilter[];
  lastCalculated: Date;
  roleMatrixVersion: string;
}

// ===========================================
// Business Logic Types
// ===========================================

export interface RoleCalculationResult {
  roles: Role[];
  permissions: Permission[];
  rlsFilters: RLSFilter[];
  sodViolations: SoDRuleInfo[];
  matchedMappings: RoleMatrixMapping[];
}

export interface PermissionHash {
  hash: string;
  permissions: Permission[];
  generatedAt: Date;
}

export interface RBACValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sodViolations: SoDRuleInfo[];
}

// Export SoDValidationResult as alias
export type SoDValidationResult = RBACValidationResult;

// ===========================================
// Error Types
// ===========================================

export class RBACError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
  ) {
    super(message);
    this.name = 'RBACError';
  }
}

export class RoleCalculationError extends RBACError {
  constructor(employeeId: string, reason: string) {
    super(`Failed to calculate roles for employee ${employeeId}: ${reason}`, 'ROLE_CALCULATION_FAILED', {
      employeeId,
      reason,
    });
    this.name = 'RoleCalculationError';
  }
}

export class SoDViolationError extends RBACError {
  constructor(employeeId: string, violations: SoDRuleInfo[]) {
    super(`SoD violations detected for employee ${employeeId}`, 'SOD_VIOLATION', {
      employeeId,
      violations,
    });
    this.name = 'SoDViolationError';
  }
}

export class PolicyNotPublishedError extends RBACError {
  constructor(version: string) {
    super(`Role matrix version ${version} is not published`, 'POLICY_NOT_PUBLISHED', {
      version,
    });
    this.name = 'PolicyNotPublishedError';
  }
}

export class TempRoleExpiredError extends RBACError {
  constructor(tempRoleId: string) {
    super(`Temporary role ${tempRoleId} has expired`, 'TEMP_ROLE_EXPIRED', {
      tempRoleId,
    });
    this.name = 'TempRoleExpiredError';
  }
}

// ===========================================
// Constants and Configurations
// ===========================================

export const RBAC_MODULES = [
  'booking',
  'vehicle',
  'driver',
  'finance',
  'approval',
  'assignment',
  'execution',
  'reports',
  'analytics',
  'admin',
] as const;

export const RBAC_ACTIONS = [
  'create',
  'read',
  'update',
  'delete',
  'approve',
  'reject',
  'close',
  'export',
  'import',
  'manage',
] as const;

export const SYSTEM_ROLES = {
  ADMIN: 'ADMIN' as Role,
  USER: 'USER' as Role,
  LEADER: 'LEADER' as Role,
  GA: 'GA' as Role,
  DRIVER: 'DRIVER' as Role,
  FINANCE: 'FINANCE' as Role,
  MANAGEMENT: 'MANAGEMENT' as Role,
  AUDITOR: 'AUDITOR' as Role,
} as const;

export const DEFAULT_ROLE_LEVELS: Record<Role, number> = {
  [Role.USER]: 1,
  [Role.LEADER]: 2,
  [Role.GA]: 3,
  [Role.DRIVER]: 4,
  [Role.FINANCE]: 5,
  [Role.MANAGEMENT]: 6,
  [Role.ADMIN]: 99,
  [Role.AUDITOR]: 10,
};

export const AUDIT_RETENTION_YEARS = 5;
