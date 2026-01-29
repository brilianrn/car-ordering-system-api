import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaClient, Role } from '@prisma/client';
import { clientDb } from '../../../shared/utils';
import { IUsecaseResponse } from '../../../shared/utils/rest-api/types';
import { ISoDRuleListResponse, ISoDViolationListResponse } from '../domain/response';
import { CreateSoDRuleRequest, SoDRuleInfo, SoDValidationResult } from '../domain/types';

@Injectable()
export class SoDService {
  private readonly logger = new Logger(SoDService.name);
  private readonly db: PrismaClient = clientDb;

  /**
   * Validate if a set of roles violates any SoD rules
   */
  async validateRoles(roles: Role[]): Promise<IUsecaseResponse<SoDValidationResult>> {
    try {
      const result: SoDValidationResult = {
        isValid: true,
        sodViolations: [],
        errors: [],
        warnings: [],
      };

      // Check each pair of roles
      for (let i = 0; i < roles.length; i++) {
        for (let j = i + 1; j < roles.length; j++) {
          const violation = await this.checkRolePair(roles[i], roles[j]);
          if (violation) {
            result.sodViolations.push(violation);
          }
        }
      }

      result.isValid = result.sodViolations.length === 0;

      return {
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to validate roles: ${error.message}`, error.stack);
      return {
        error: {
          message: error.message || 'Validation failed',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
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

    return this.mapSoDRuleToDomain(rule);
  }

  /**
   * Create a new SoD rule
   */
  async createSoDRule(request: CreateSoDRuleRequest, createdBy: string): Promise<IUsecaseResponse<SoDRuleInfo>> {
    try {
      this.logger.log(`Creating SoD rule: ${request.name}`);

      // Validate roles exist
      const [primaryRole, conflictingRole] = await Promise.all([
        (this.db as any).role.findUnique({ where: { id: request.primaryRoleId } }),
        (this.db as any).role.findUnique({ where: { id: request.conflictingRoleId } }),
      ]);

      if (!primaryRole) {
        return {
          error: {
            message: `Primary role ${request.primaryRoleId} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      if (!conflictingRole) {
        return {
          error: {
            message: `Conflicting role ${request.conflictingRoleId} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
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
        return {
          error: {
            message: 'SoD rule already exists for this role pair',
            code: HttpStatus.BAD_REQUEST,
          },
        };
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
      return { data: this.mapSoDRuleToDomain(rule) };
    } catch (error) {
      this.logger.error(`Failed to create SoD rule: ${error.message}`, error.stack);
      return {
        error: {
          message: error.message || 'Failed to create SoD rule',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }

  /**
   * Get all active SoD rules
   */
  async getActiveSoDRules(): Promise<IUsecaseResponse<ISoDRuleListResponse>> {
    try {
      const rules = await (this.db as any).soDRule.findMany({
        where: { isActive: true },
        include: {
          role: true,
          conflictingRole: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        data: {
          data: rules.map((rule: any) => this.mapSoDRuleToDomain(rule)),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get SoD rules: ${error.message}`, error.stack);
      return {
        error: {
          message: error.message || 'Failed to get SoD rules',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }

  /**
   * Deactivate an SoD rule
   */
  async deactivateSoDRule(ruleId: string, deactivatedBy: string): Promise<IUsecaseResponse<void>> {
    try {
      const rule = await (this.db as any).soDRule.findUnique({
        where: { id: ruleId },
      });

      if (!rule) {
        return {
          error: {
            message: 'SoD rule not found',
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      await (this.db as any).soDRule.update({
        where: { id: ruleId },
        data: {
          isActive: false,
          updatedBy: deactivatedBy,
        },
      });

      this.logger.log(`SoD rule deactivated: ${rule.name}`);
      return { data: undefined };
    } catch (error) {
      this.logger.error(`Failed to deactivate SoD rule: ${error.message}`, error.stack);
      return {
        error: {
          message: error.message || 'Failed to deactivate SoD rule',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }

  /**
   * Get SoD violations for a specific employee
   */
  async getEmployeeSoDViolations(employeeId: string): Promise<IUsecaseResponse<SoDValidationResult>> {
    try {
      // Get current effective roles for the employee
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
        error: {
          message: error.message || 'Failed to check violations',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }

  /**
   * Get all employees with SoD violations
   */
  async getAllSoDViolations(limit: number = 100): Promise<IUsecaseResponse<ISoDViolationListResponse>> {
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

        if (validation.data && !validation.data.isValid) {
          violations.push({
            employeeId: employee.employeeId,
            employeeName: employee.fullName,
            violations: validation.data.sodViolations,
          });
        }
      }

      return {
        data: {
          data: violations,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get all SoD violations: ${error.message}`, error.stack);
      return {
        error: {
          message: error.message || 'Failed to get SoD violations',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }

  /**
   * Get SoD rules that would be affected by role changes
   */
  async getAffectedSoDRules(roleIds: string[]): Promise<IUsecaseResponse<ISoDRuleListResponse>> {
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

      return {
        data: {
          data: rules.map((rule: any) => this.mapSoDRuleToDomain(rule)),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get affected SoD rules: ${error.message}`, error.stack);
      return {
        error: {
          message: error.message || 'Failed to get affected SoD rules',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  }

  private mapSoDRuleToDomain(rule: any): SoDRuleInfo {
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      role: {
        id: rule.role.id,
        name: rule.role.name,
        displayName: rule.role.displayName,
        description: rule.role.description,
        level: rule.role.level,
        isActive: rule.role.isActive,
      },
      conflictingRole: {
        id: rule.conflictingRole.id,
        name: rule.conflictingRole.name,
        displayName: rule.conflictingRole.displayName,
        description: rule.conflictingRole.description,
        level: rule.conflictingRole.level,
        isActive: rule.conflictingRole.isActive,
      },
      isActive: rule.isActive,
    };
  }
}
