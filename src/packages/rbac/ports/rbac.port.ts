import {
  CalculateRolesRequest,
  CalculateRolesResponse,
  AssignTempRoleRequest,
  RevokeTempRoleRequest,
  UserRBACInfo,
  RBACValidationResult,
} from '../domain/types';

export interface RBACServicePort {
  // Role calculation
  calculateEffectiveRoles(request: CalculateRolesRequest): Promise<CalculateRolesResponse>;
  getUserRBACInfo(employeeId: string): Promise<UserRBACInfo>;

  // Temporary roles
  assignTempRole(request: AssignTempRoleRequest, assignedBy: string): Promise<any>;
  revokeTempRole(request: RevokeTempRoleRequest, revokedBy: string): Promise<void>;
  cleanupExpiredTempRoles(): Promise<number>;

  // Validation
  validateRoleAssignment(employeeId: string, newRoles: any[]): Promise<RBACValidationResult>;
}
