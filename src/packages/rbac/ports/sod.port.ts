import { SoDRuleInfo, SoDValidationResult } from '../domain/types';

export interface CreateSoDRuleRequest {
  name: string;
  description?: string;
  primaryRoleId: string;
  conflictingRoleId: string;
}

export interface SoDServicePort {
  // Rule management
  createSoDRule(request: CreateSoDRuleRequest, createdBy: string): Promise<SoDRuleInfo>;
  getActiveSoDRules(): Promise<SoDRuleInfo[]>;
  deactivateSoDRule(ruleId: string, deactivatedBy: string): Promise<void>;

  // Validation
  validateRoles(roles: any[]): Promise<SoDValidationResult>;
  getEmployeeSoDViolations(employeeId: string): Promise<SoDValidationResult>;
  getAllSoDViolations(limit?: number): Promise<
    Array<{
      employeeId: string;
      employeeName: string;
      violations: SoDRuleInfo[];
    }>
  >;

  // Utilities
  getAffectedSoDRules(roleIds: string[]): Promise<SoDRuleInfo[]>;
}
