import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient, Role } from '@prisma/client';
import { clientDb } from '../../../shared/utils';
import { RBACError } from '../domain/types';

export interface SoDRuleInfo {
  id: string;
  name: string;
  description?: string;
  primaryRole: {
    id: string;
    name: Role;
    displayName: string;
  };
  conflictingRole: {
    id: string;
    name: Role;
    displayName: string;
  };
  isActive: boolean;
}

export interface SoDValidationResult {
  isValid: boolean;
  violations: SoDRuleInfo[];
  errorMessage?: string;
}

export interface CreateSoDRuleRequest {
  name: string;
  description?: string;
  primaryRoleId: string;
  conflictingRoleId: string;
}

@Injectable()
export class SoDService {
  private readonly logger = new Logger(SoDService.name);
  private readonly db: PrismaClient = clientDb;

  /**
   * Validate if a set of roles violates any SoD rules
   */
  async validateRoles(roles: Role[]): Promise<SoDValidationResult> {
    try {
      const violations: SoDRuleInfo[] = [];

      // Check each pair of roles
      for (let i = 0; i < roles.length; i++) {
        for (let j = i + 1; j < roles.length; j++) {
          const violation = await this.checkRolePair(roles[i], roles[j]);
          if (violation) {
            violations.push(violation);
          }
        }
      }

      return {
        isValid: violations.length === 0,
        violations,
      };
    } catch (error) {
      this.logger.error(`Failed to validate roles: ${error.message}`, error.stack);
      return {
        isValid: false,
        violations: [],
        errorMessage: `Validation failed: ${error.message}`,
      };
    }
  }

  /**
   * Check if two specific roles conflict
   */
  private async checkRolePair(role1: Role, role2: Role): Promise<SoDRuleInfo | null> {
    const rule = await (this.db as any).soDRule.findFirst({
      where: {
        isActive: true,
        OR: [
          {
            AND: [{ roleId: role1.toString() }, { conflictingRoleId: role2.toString() }],
          },
          {
            AND: [{ roleId: role2.toString() }, { conflictingRoleId: role1.toString() }],
          },
        ],
      },
      include: {
        role: true,
        conflictingRole: true,
      },
    });

    if (!rule) {
      return null;
    }

    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      primaryRole: {
        id: rule.role.id,
        name: rule.role.name,
        displayName: rule.role.displayName,
      },
      conflictingRole: {
        id: rule.conflictingRole.id,
        name: rule.conflictingRole.name,
        displayName: rule.conflictingRole.displayName,
      },
      isActive: rule.isActive,
    };
  }

  /**
   * Create a new SoD rule
   */
  async createSoDRule(request: CreateSoDRuleRequest, createdBy: string): Promise<SoDRuleInfo> {
    try {
      this.logger.log(`Creating SoD rule: ${request.name}`);

      // Validate roles exist
      const [primaryRole, conflictingRole] = await Promise.all([
        (this.db as any).role.findUnique({ where: { id: request.primaryRoleId } }),
        (this.db as any).role.findUnique({ where: { id: request.conflictingRoleId } }),
      ]);

      if (!primaryRole) {
        throw new RBACError(`Primary role ${request.primaryRoleId} not found`, 'ROLE_NOT_FOUND');
      }

      if (!conflictingRole) {
        throw new RBACError(`Conflicting role ${request.conflictingRoleId} not found`, 'ROLE_NOT_FOUND');
      }

      // Check if rule already exists (bidirectional)
      const existingRule = await (this.db as any).soDRule.findFirst({
        where: {
          OR: [
            {
              AND: [{ roleId: request.primaryRoleId }, { conflictingRoleId: request.conflictingRoleId }],
            },
            {
              AND: [{ roleId: request.conflictingRoleId }, { conflictingRoleId: request.primaryRoleId }],
            },
          ],
        },
      });

      if (existingRule) {
        throw new RBACError('SoD rule already exists for this role pair', 'RULE_EXISTS');
      }

      // Create the rule
      const rule = await (this.db as any).soDRule.create({
        data: {
          name: request.name,
          description: request.description,
          roleId: request.primaryRoleId,
          conflictingRoleId: request.conflictingRoleId,
          createdBy,
        },
        include: {
          role: true,
          conflictingRole: true,
        },
      });

      this.logger.log(`SoD rule created: ${rule.name}`);
      return this.mapSoDRuleToDomain(rule);
    } catch (error) {
      this.logger.error(`Failed to create SoD rule: ${error.message}`, error.stack);
      throw error instanceof RBACError
        ? error
        : new RBACError(`Failed to create SoD rule: ${error.message}`, 'CREATE_FAILED');
    }
  }

  /**
   * Get all active SoD rules
   */
  async getActiveSoDRules(): Promise<SoDRuleInfo[]> {
    try {
      const rules = await (this.db as any).soDRule.findMany({
        where: { isActive: true },
        include: {
          role: true,
          conflictingRole: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return rules.map((rule) => this.mapSoDRuleToDomain(rule));
    } catch (error) {
      this.logger.error(`Failed to get SoD rules: ${error.message}`, error.stack);
      throw new RBACError(`Failed to get SoD rules: ${error.message}`, 'GET_FAILED');
    }
  }

  /**
   * Deactivate an SoD rule
   */
  async deactivateSoDRule(ruleId: string, deactivatedBy: string): Promise<void> {
    try {
      const rule = await (this.db as any).soDRule.findUnique({
        where: { id: ruleId },
      });

      if (!rule) {
        throw new RBACError('SoD rule not found', 'RULE_NOT_FOUND');
      }

      await (this.db as any).soDRule.update({
        where: { id: ruleId },
        data: {
          isActive: false,
          updatedBy: deactivatedBy,
        },
      });

      this.logger.log(`SoD rule deactivated: ${rule.name}`);
    } catch (error) {
      this.logger.error(`Failed to deactivate SoD rule: ${error.message}`, error.stack);
      throw error instanceof RBACError
        ? error
        : new RBACError(`Failed to deactivate SoD rule: ${error.message}`, 'DEACTIVATE_FAILED');
    }
  }

  /**
   * Get SoD violations for a specific employee
   */
  async getEmployeeSoDViolations(employeeId: string): Promise<SoDValidationResult> {
    try {
      // Get current effective roles for the employee
      // This would typically come from RBACService.calculateEffectiveRoles
      // For now, we'll get from user roles + temp roles
      const userRoles = await (this.db as any).userRole.findMany({
        where: {
          employeeId,
          isActive: true,
        },
        include: { role: true },
      });

      const tempRoles = await (this.db as any).tempRole.findMany({
        where: {
          employeeId,
          status: 'ACTIVE',
          tempRoleEnd: { gt: new Date() },
        },
        include: { role: true },
      });

      const allRoles = [...userRoles.map((ur) => ur.role.name), ...tempRoles.map((tr) => tr.role.name)];

      const uniqueRoles = [...new Set(allRoles)];

      return await this.validateRoles(uniqueRoles);
    } catch (error) {
      this.logger.error(`Failed to get employee SoD violations: ${error.message}`, error.stack);
      return {
        isValid: false,
        violations: [],
        errorMessage: `Failed to check violations: ${error.message}`,
      };
    }
  }

  /**
   * Get all employees with SoD violations
   */
  async getAllSoDViolations(limit: number = 100): Promise<
    Array<{
      employeeId: string;
      employeeName: string;
      violations: SoDRuleInfo[];
    }>
  > {
    try {
      // Get all employees with roles
      const employeesWithRoles = await (this.db as any).employee.findMany({
        where: {
          OR: [
            { userRoles: { some: { isActive: true } } },
            { tempRoles: { some: { status: 'ACTIVE', tempRoleEnd: { gt: new Date() } } } },
          ],
        },
        include: {
          userRoles: {
            where: { isActive: true },
            include: { role: true },
          },
          tempRoles: {
            where: {
              status: 'ACTIVE',
              tempRoleEnd: { gt: new Date() },
            },
            include: { role: true },
          },
        },
        take: limit,
      });

      const violations: Array<{
        employeeId: string;
        employeeName: string;
        violations: SoDRuleInfo[];
      }> = [];

      for (const employee of employeesWithRoles) {
        const allRoles = [
          ...employee.userRoles.map((ur) => ur.role.name),
          ...employee.tempRoles.map((tr) => tr.role.name),
        ];

        const uniqueRoles = [...new Set(allRoles)];
        const validation = await this.validateRoles(uniqueRoles);

        if (!validation.isValid) {
          violations.push({
            employeeId: employee.employeeId,
            employeeName: employee.fullName,
            violations: validation.violations,
          });
        }
      }

      return violations;
    } catch (error) {
      this.logger.error(`Failed to get all SoD violations: ${error.message}`, error.stack);
      throw new RBACError(`Failed to get SoD violations: ${error.message}`, 'GET_VIOLATIONS_FAILED');
    }
  }

  /**
   * Get SoD rules that would be affected by role changes
   */
  async getAffectedSoDRules(roleIds: string[]): Promise<SoDRuleInfo[]> {
    try {
      const rules = await (this.db as any).soDRule.findMany({
        where: {
          isActive: true,
          OR: [{ roleId: { in: roleIds } }, { conflictingRoleId: { in: roleIds } }],
        },
        include: {
          role: true,
          conflictingRole: true,
        },
      });

      return rules.map((rule) => this.mapSoDRuleToDomain(rule));
    } catch (error) {
      this.logger.error(`Failed to get affected SoD rules: ${error.message}`, error.stack);
      throw new RBACError(`Failed to get affected SoD rules: ${error.message}`, 'GET_AFFECTED_FAILED');
    }
  }

  private mapSoDRuleToDomain(rule: any): SoDRuleInfo {
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      primaryRole: {
        id: rule.role.id,
        name: rule.role.name,
        displayName: rule.role.displayName,
      },
      conflictingRole: {
        id: rule.conflictingRole.id,
        name: rule.conflictingRole.name,
        displayName: rule.conflictingRole.displayName,
      },
      isActive: rule.isActive,
    };
  }
}
