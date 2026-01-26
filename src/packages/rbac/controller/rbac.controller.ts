import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Put, Query, Request } from '@nestjs/common';

import { RBACService } from '../services/rbac.service';
import { RoleMatrixService } from '../services/role-matrix.service';
import { SoDService } from '../services/sod.service';

import {
  AssignTempRoleDto,
  CalculateRolesDto,
  CalculateRolesResponseDto,
  CreateRoleMatrixDto,
  CreateSoDRuleDto,
  PublishRoleMatrixDto,
  RevokeTempRoleDto,
  RoleMatrixInfoDto,
  RoleMatrixMappingDto,
  SoDRuleInfoDto,
  SoDValidationResultDto,
  UserRBACInfoDto,
} from '../dto';

import { RBACError } from '../domain/types';

@Controller('rbac')
export class RBACController {
  constructor(
    @Inject('RBACService')
    private readonly rbacService: RBACService,

    @Inject('RoleMatrixService')
    private readonly roleMatrixService: RoleMatrixService,

    @Inject('SoDService')
    private readonly sodService: SoDService,
  ) {}

  // ===========================================
  // USER RBAC INFO & ROLE CALCULATION
  // ===========================================

  @Get('user/:employeeId')
  async getUserRBACInfo(@Param('employeeId') employeeId: string): Promise<UserRBACInfoDto> {
    try {
      const result = await this.rbacService.getUserRBACInfo(employeeId);
      return {
        employeeId: result.employeeId,
        currentRoles: result.currentRoles.map((role) => ({
          id: role.id,
          roleId: role.roleId,
          role: {
            id: role.role.name.toString(),
            name: role.role.name,
            displayName: role.role.displayName,
            level: role.role.level,
            isActive: role.role.isActive,
          },
          assignedBy: role.assignedBy,
          assignedAt: role.assignedAt,
          expiresAt: role.expiresAt,
          reason: role.reason,
          isActive: role.isActive,
        })),
        tempRoles: result.tempRoles.map((role) => ({
          id: role.id,
          roleId: role.roleId,
          role: {
            id: role.role.name.toString(),
            name: role.role.name,
            displayName: role.role.displayName,
            level: role.role.level,
            isActive: role.role.isActive,
          },
          reason: role.reason,
          tempRoleEnd: role.tempRoleEnd,
          assignedBy: role.assignedBy,
          assignedAt: role.assignedAt,
          status: role.status,
        })),
        effectiveRoles: result.effectiveRoles,
        effectivePermissions: result.effectivePermissions,
        rlsFilters: result.rlsFilters,
        lastCalculated: result.lastCalculated,
        roleMatrixVersion: result.roleMatrixVersion,
      };
    } catch (error) {
      throw new RBACError(`Failed to get user RBAC info: ${error.message}`, 'GET_USER_FAILED');
    }
  }

  @Post('calculate-roles')
  @HttpCode(HttpStatus.OK)
  async calculateRoles(@Body() dto: CalculateRolesDto): Promise<CalculateRolesResponseDto> {
    try {
      const result = await this.rbacService.calculateEffectiveRoles({
        employeeId: dto.employeeId,
        hrisAttributes: dto.hrisAttributes || {},
      });

      return {
        employeeId: result.employeeId,
        effectiveRoles: result.effectiveRoles,
        permissions: result.permissions,
        rlsFilters: result.rlsFilters,
        sodViolations: result.sodViolations.map((v: any) => ({
          id: v.id,
          name: v.name,
          description: v.description,
          primaryRole: {
            id: v.primaryRole?.id || v.role?.id,
            name: v.primaryRole?.name || v.role?.name,
            displayName: v.primaryRole?.displayName || v.role?.displayName,
            level: v.primaryRole?.level || v.role?.level || 0,
            isActive: v.primaryRole?.isActive || v.role?.isActive || true,
          },
          conflictingRole: {
            id: v.conflictingRole.id,
            name: v.conflictingRole.name,
            displayName: v.conflictingRole.displayName,
            level: v.conflictingRole.level || 0,
            isActive: v.conflictingRole.isActive || true,
          },
          isActive: v.isActive,
        })),
        roleMatrixVersion: result.roleMatrixVersion,
      };
    } catch (error) {
      throw new RBACError(`Failed to calculate roles: ${error.message}`, 'CALCULATE_FAILED');
    }
  }

  // ===========================================
  // TEMPORARY ROLES MANAGEMENT
  // ===========================================

  @Post('temp-roles')
  @HttpCode(HttpStatus.CREATED)
  async assignTempRole(@Body() dto: AssignTempRoleDto, @Request() req: any) {
    try {
      const assignedBy = req.user?.employeeId || 'SYSTEM';
      const tempRoleEnd = new Date(dto.tempRoleEnd);

      await this.rbacService.assignTempRole(
        {
          employeeId: dto.employeeId,
          roleId: dto.roleId,
          reason: dto.reason,
          tempRoleEnd,
        },
        assignedBy,
      );

      return { message: 'Temporary role assigned successfully' };
    } catch (error) {
      throw new RBACError(`Failed to assign temp role: ${error.message}`, 'ASSIGN_FAILED');
    }
  }

  @Put('temp-roles/revoke')
  @HttpCode(HttpStatus.OK)
  async revokeTempRole(@Body() dto: RevokeTempRoleDto, @Request() req: any) {
    try {
      const revokedBy = req.user?.employeeId || 'SYSTEM';

      await this.rbacService.revokeTempRole(
        {
          tempRoleId: dto.tempRoleId,
          revokeReason: dto.revokeReason || 'Revoked by admin',
        },
        revokedBy,
      );

      return { message: 'Temporary role revoked successfully' };
    } catch (error) {
      throw new RBACError(`Failed to revoke temp role: ${error.message}`, 'REVOKE_FAILED');
    }
  }

  @Post('temp-roles/cleanup')
  @HttpCode(HttpStatus.OK)
  async cleanupExpiredTempRoles() {
    try {
      const cleanedCount = await this.rbacService.cleanupExpiredTempRoles();
      return {
        message: `Cleanup completed. ${cleanedCount} expired temporary roles cleaned up.`,
        cleanedCount,
      };
    } catch (error) {
      throw new RBACError(`Cleanup failed: ${error.message}`, 'CLEANUP_FAILED');
    }
  }

  // ===========================================
  // ROLE MATRIX MANAGEMENT
  // ===========================================

  @Get('role-matrices/active')
  async getActiveRoleMatrix(): Promise<RoleMatrixInfoDto | null> {
    try {
      const matrix = await this.roleMatrixService.getActiveRoleMatrix();
      return matrix
        ? {
            id: matrix.id,
            version: matrix.version,
            name: matrix.name,
            description: matrix.description,
            status: matrix.status,
            permissionHash: matrix.permissionHash,
            effectiveFrom: matrix.effectiveFrom,
            effectiveTo: matrix.effectiveTo,
            editorId: matrix.editorId,
            reviewerId: matrix.reviewerId,
            reviewedAt: matrix.reviewedAt,
          }
        : null;
    } catch (error) {
      throw new RBACError(`Failed to get active role matrix: ${error.message}`, 'GET_ACTIVE_FAILED');
    }
  }

  @Get('role-matrices/:version')
  async getRoleMatrixByVersion(@Param('version') version: string): Promise<RoleMatrixInfoDto | null> {
    try {
      const matrix = await this.roleMatrixService.getRoleMatrixByVersion(version);
      return matrix
        ? {
            id: matrix.id,
            version: matrix.version,
            name: matrix.name,
            description: matrix.description,
            status: matrix.status,
            permissionHash: matrix.permissionHash,
            effectiveFrom: matrix.effectiveFrom,
            effectiveTo: matrix.effectiveTo,
            editorId: matrix.editorId,
            reviewerId: matrix.reviewerId,
            reviewedAt: matrix.reviewedAt,
          }
        : null;
    } catch (error) {
      throw new RBACError(`Failed to get role matrix: ${error.message}`, 'GET_MATRIX_FAILED');
    }
  }

  @Get('role-matrices')
  async listRoleMatrices(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<RoleMatrixInfoDto[]> {
    try {
      const statusEnum = status as any;
      const limitNum = limit ? parseInt(limit) : 50;
      const offsetNum = offset ? parseInt(offset) : 0;

      const matrices = await this.roleMatrixService.listRoleMatrices(statusEnum, limitNum, offsetNum);
      return matrices.map((matrix) => ({
        id: matrix.id,
        version: matrix.version,
        name: matrix.name,
        description: matrix.description,
        status: matrix.status,
        permissionHash: matrix.permissionHash,
        effectiveFrom: matrix.effectiveFrom,
        effectiveTo: matrix.effectiveTo,
        editorId: matrix.editorId,
        reviewerId: matrix.reviewerId,
        reviewedAt: matrix.reviewedAt,
      }));
    } catch (error) {
      throw new RBACError(`Failed to list role matrices: ${error.message}`, 'LIST_FAILED');
    }
  }

  @Post('role-matrices')
  @HttpCode(HttpStatus.CREATED)
  async createRoleMatrix(@Body() dto: CreateRoleMatrixDto, @Request() req: any): Promise<RoleMatrixInfoDto> {
    try {
      const createdBy = req.user?.employeeId || 'SYSTEM';
      const effectiveFrom = new Date(dto.effectiveFrom);
      const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : undefined;

      const result = await this.roleMatrixService.createRoleMatrix(
        {
          version: dto.version,
          name: dto.name,
          description: dto.description,
          mappings: dto.mappings,
          effectiveFrom,
          effectiveTo,
        },
        createdBy,
      );

      return {
        id: result.id,
        version: result.version,
        name: result.name,
        description: result.description,
        status: result.status,
        permissionHash: result.permissionHash,
        effectiveFrom: result.effectiveFrom,
        effectiveTo: result.effectiveTo,
        editorId: result.editorId,
        reviewerId: result.reviewerId,
        reviewedAt: result.reviewedAt,
      };
    } catch (error) {
      throw new RBACError(`Failed to create role matrix: ${error.message}`, 'CREATE_FAILED');
    }
  }

  @Post('role-matrices/:roleMatrixId/publish')
  @HttpCode(HttpStatus.OK)
  async publishRoleMatrix(
    @Param('roleMatrixId') roleMatrixId: string,
    @Body() dto: PublishRoleMatrixDto,
  ): Promise<RoleMatrixInfoDto> {
    try {
      const result = await this.roleMatrixService.publishRoleMatrix(
        {
          roleMatrixId,
          reviewerId: dto.reviewerId,
        },
        dto.reviewerId,
      );

      return {
        id: result.id,
        version: result.version,
        name: result.name,
        description: result.description,
        status: result.status,
        permissionHash: result.permissionHash,
        effectiveFrom: result.effectiveFrom,
        effectiveTo: result.effectiveTo,
        editorId: result.editorId,
        reviewerId: result.reviewerId,
        reviewedAt: result.reviewedAt,
      };
    } catch (error) {
      throw new RBACError(`Failed to publish role matrix: ${error.message}`, 'PUBLISH_FAILED');
    }
  }

  @Get('role-matrices/:roleMatrixId/mappings')
  async getRoleMatrixMappings(@Param('roleMatrixId') roleMatrixId: string): Promise<RoleMatrixMappingDto[]> {
    try {
      const mappings = await this.roleMatrixService.getRoleMatrixMappings(roleMatrixId);
      return mappings.map((mapping) => ({
        id: mapping.id,
        roleId: mapping.roleId,
        role: {
          id: mapping.role.name.toString(),
          name: mapping.role.name,
          displayName: mapping.role.displayName,
          level: mapping.role.level,
          isActive: mapping.role.isActive,
        },
        orgUnitCode: mapping.orgUnitCode,
        orgUnitPattern: mapping.orgUnitPattern,
        division: mapping.division,
        department: mapping.department,
        costCenter: mapping.costCenter,
        position: mapping.position,
        positionPattern: mapping.positionPattern,
        jobFamily: mapping.jobFamily,
        jobFamilyPattern: mapping.jobFamilyPattern,
        priority: mapping.priority,
      }));
    } catch (error) {
      throw new RBACError(`Failed to get mappings: ${error.message}`, 'GET_MAPPINGS_FAILED');
    }
  }

  // ===========================================
  // SOD RULES MANAGEMENT
  // ===========================================

  @Post('sod-rules')
  @HttpCode(HttpStatus.CREATED)
  async createSoDRule(@Body() dto: CreateSoDRuleDto, @Request() req: any): Promise<SoDRuleInfoDto> {
    try {
      const createdBy = req.user?.employeeId || 'SYSTEM';
      const result = await this.sodService.createSoDRule(
        {
          name: dto.name,
          description: dto.description,
          primaryRoleId: dto.primaryRoleId,
          conflictingRoleId: dto.conflictingRoleId,
        },
        createdBy,
      ) as any;

      return {
        id: result.id,
        name: result.name,
        description: result.description,
        primaryRole: {
          id: result.primaryRole?.id || result.role?.id,
          name: result.primaryRole?.name || result.role?.name,
          displayName: result.primaryRole?.displayName || result.role?.displayName,
          level: result.primaryRole?.level || result.role?.level || 0,
          isActive: result.primaryRole?.isActive || result.role?.isActive || true,
        },
        conflictingRole: {
          id: result.conflictingRole.id,
          name: result.conflictingRole.name,
          displayName: result.conflictingRole.displayName,
          level: result.conflictingRole.level || 0,
          isActive: result.conflictingRole.isActive || true,
        },
        isActive: result.isActive,
      };
    } catch (error) {
      throw new RBACError(`Failed to create SoD rule: ${error.message}`, 'CREATE_SOD_FAILED');
    }
  }

  @Get('sod-rules')
  async getActiveSoDRules(): Promise<SoDRuleInfoDto[]> {
    try {
      const rules = await this.sodService.getActiveSoDRules();
      return rules.map((rule: any) => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        primaryRole: {
          id: rule.primaryRole?.id || rule.role?.id,
          name: rule.primaryRole?.name || rule.role?.name,
          displayName: rule.primaryRole?.displayName || rule.role?.displayName,
          level: rule.primaryRole?.level || rule.role?.level || 0,
          isActive: rule.primaryRole?.isActive || rule.role?.isActive || true,
        },
        conflictingRole: {
          id: rule.conflictingRole.id,
          name: rule.conflictingRole.name,
          displayName: rule.conflictingRole.displayName,
          level: rule.conflictingRole.level || 0,
          isActive: rule.conflictingRole.isActive || true,
        },
        isActive: rule.isActive,
      }));
    } catch (error) {
      throw new RBACError(`Failed to get SoD rules: ${error.message}`, 'GET_SOD_FAILED');
    }
  }

  @Post('validate-roles')
  @HttpCode(HttpStatus.OK)
  async validateRoles(@Body() body: { roles: string[] }): Promise<SoDValidationResultDto> {
    try {
      const roles = body.roles as any[];
      const result = await this.sodService.validateRoles(roles);

      return {
        isValid: result.isValid,
        violations: result.violations.map((v: any) => ({
          id: v.id,
          name: v.name,
          description: v.description,
          primaryRole: {
            id: v.primaryRole?.id || v.role?.id,
            name: v.primaryRole?.name || v.role?.name,
            displayName: v.primaryRole?.displayName || v.role?.displayName,
            level: v.primaryRole?.level || v.role?.level || 0,
            isActive: v.primaryRole?.isActive || v.role?.isActive || true,
          },
          conflictingRole: {
            id: v.conflictingRole.id,
            name: v.conflictingRole.name,
            displayName: v.conflictingRole.displayName,
            level: v.conflictingRole.level || 0,
            isActive: v.conflictingRole.isActive || true,
          },
          isActive: v.isActive,
        })),
        errorMessage: result.errorMessage,
      };
    } catch (error) {
      throw new RBACError(`Failed to validate roles: ${error.message}`, 'VALIDATE_FAILED');
    }
  }

  @Get('sod-violations')
  async getAllSoDViolations(@Query('limit') limit?: string) {
    try {
      const limitNum = limit ? parseInt(limit) : 100;
      const violations = await this.sodService.getAllSoDViolations(limitNum);

      return violations.map((v) => ({
        employeeId: v.employeeId,
        employeeName: v.employeeName,
        violations: v.violations.map((vio: any) => ({
          id: vio.id,
          name: vio.name,
          description: vio.description,
          primaryRole: {
            id: vio.primaryRole?.id || vio.role?.id,
            name: vio.primaryRole?.name || vio.role?.name,
            displayName: vio.primaryRole?.displayName || vio.role?.displayName,
            level: vio.primaryRole?.level || vio.role?.level || 0,
            isActive: vio.primaryRole?.isActive || vio.role?.isActive || true,
          },
          conflictingRole: {
            id: vio.conflictingRole.id,
            name: vio.conflictingRole.name,
            displayName: vio.conflictingRole.displayName,
            level: vio.conflictingRole.level || 0,
            isActive: vio.conflictingRole.isActive || true,
          },
          isActive: vio.isActive,
        })),
      }));
    } catch (error) {
      throw new RBACError(`Failed to get SoD violations: ${error.message}`, 'GET_VIOLATIONS_FAILED');
    }
  }
}
