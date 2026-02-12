import { validationMessage } from '@/shared/constants/validation-message';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';

import { JwtAuthGuard } from '@/packages/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/packages/auth/guards/roles.guard';

import { RBACService } from '../services/rbac.service';
import { RoleMatrixService } from '../services/role-matrix.service';
import { SoDService } from '../services/sod.service';

import {
  AssignTempRoleDto,
  CalculateRolesDto,
  CreateRoleMatrixDto,
  CreateSoDRuleDto,
  PublishRoleMatrixDto,
  RevokeTempRoleDto,
} from '../dto';

import { ERoutes } from '@/shared/constants/routes';
import { response } from '@/shared/utils/rest-api/response';

@Controller(ERoutes.RBAC)
@UseGuards(JwtAuthGuard, RolesGuard)
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
  @Get('users')
  async listUsers(
    @Res() res: Response,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('roles') roles?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    const result = await this.rbacService.listUsers(pageNum, limitNum, roles);

    if (result.error) {
      return response[result.error.code || HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: result.error.message,
      });
    }

    return response[HttpStatus.OK](res, {
      message: validationMessage('Users')[200](),
      data: result.data,
    });
  }

  @Get('audit-logs')
  async listAuditLogs(@Res() res: Response, @Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 20;
    const result = await this.rbacService.listAuditLogs(pageNum, limitNum);

    if (result.error) {
      return response[result.error.code || HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: result.error.message,
      });
    }

    return response[HttpStatus.OK](res, {
      message: validationMessage('Audit logs')[200](),
      data: result.data,
    });
  }

  @Get('user')
  async getMyRBACInfo(@Res() res: Response, @Headers('x-user-id') userId: string): Promise<any> {
    if (!userId) {
      return response[HttpStatus.BAD_REQUEST](res, {
        message: 'Employee ID is required or x-user-id header must be provided',
      });
    }
    return this.getUserRBACInfo(res, userId);
  }

  @Get('user/:employeeId')
  async getUserRBACInfo(@Res() res: Response, @Param('employeeId') employeeId: string): Promise<any> {
    const result = await this.rbacService.getUserRBACInfo(employeeId);

    if (result.error) {
      return response[result.error.code || HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: result.error.message,
      });
    }

    const data = result.data!;
    const mapped = {
      employeeId: data.employeeId,
      fullName: data.fullName,
      lastLogin: data.lastLogin,
      currentRoles: data.currentRoles.map((role) => ({
        id: role.id,
        roleId: role.roleId,
        role: {
          id: role.role.id,
          name: role.role.name,
          displayName: role.role.displayName,
          level: role.role.level,
          isActive: role.role.isActive,
        },
        assignedBy: role.assignedBy,
        assignedAt: role.assignedAt,
        expiresAt: role.expiresAt || undefined,
        reason: role.reason || undefined,
        isActive: role.isActive,
      })),
      tempRoles: data.tempRoles.map((role) => ({
        id: role.id,
        employeeId: role.employeeId,
        roleId: role.roleId,
        role: {
          id: role.role.id,
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
      effectiveRoles: data.effectiveRoles,
      effectivePermissions: data.effectivePermissions,
      rlsFilters: data.rlsFilters,
      lastCalculated: data.lastCalculated,
      roleMatrixVersion: data.roleMatrixVersion,
    };

    return response[HttpStatus.OK](res, {
      message: validationMessage('User RBAC info')[200](),
      data: mapped,
    });
  }

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  async calculateRoles(@Res() res: Response, @Body() dto: CalculateRolesDto): Promise<any> {
    const result = await this.rbacService.calculateEffectiveRoles({
      employeeId: dto.employeeId,
      hrisAttributes: dto.hrisAttributes || {},
    });

    if (result.error) {
      return response[result.error.code || HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: result.error.message,
      });
    }

    const data = result.data!;
    const mapped = {
      employeeId: data.employeeId,
      effectiveRoles: data.effectiveRoles,
      permissions: data.permissions,
      rlsFilters: data.rlsFilters,
      sodViolations: data.sodViolations.map((v) => ({
        id: v.id,
        name: v.name,
        description: v.description,
        primaryRole: {
          id: v.role?.id,
          name: v.role?.name,
          displayName: v.role?.displayName,
          level: v.role?.level || 0,
          isActive: v.role?.isActive ?? true,
        },
        conflictingRole: {
          id: v.conflictingRole?.id,
          name: v.conflictingRole?.name,
          displayName: v.conflictingRole?.displayName,
          level: v.conflictingRole?.level || 0,
          isActive: v.conflictingRole?.isActive ?? true,
        },
        isActive: v.isActive,
      })),
      roleMatrixVersion: data.roleMatrixVersion,
    };

    return response[HttpStatus.OK](res, {
      message: validationMessage('Roles')[200](),
      data: mapped,
    });
  }

  // ===========================================
  // TEMPORARY ROLES MANAGEMENT
  // ===========================================

  @Post('temp-roles')
  @HttpCode(HttpStatus.CREATED)
  async assignTempRole(@Res() res: Response, @Body() dto: AssignTempRoleDto, @Headers('x-user-id') userId: string) {
    const assignedBy = userId || 'SYSTEM';
    const tempRoleEnd = new Date(dto.tempRoleEnd);

    const result = await this.rbacService.assignTempRole(
      {
        employeeId: dto.employeeId,
        roleId: dto.roleId,
        reason: dto.reason,
        tempRoleEnd,
      },
      assignedBy,
    );

    if (result.error) {
      return response[result.error.code || HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: result.error.message,
      });
    }

    return response[HttpStatus.CREATED](res, {
      message: 'Temporary role assigned successfully',
      data: result.data,
    });
  }

  @Put('temp-roles/revoke')
  @HttpCode(HttpStatus.OK)
  async revokeTempRole(@Res() res: Response, @Body() dto: RevokeTempRoleDto, @Headers('x-user-id') userId: string) {
    const revokedBy = userId || 'SYSTEM';

    const result = await this.rbacService.revokeTempRole(
      {
        tempRoleId: dto.tempRoleId,
        revokeReason: dto.revokeReason || 'Revoked by admin',
      },
      revokedBy,
    );

    if (result.error) {
      return response[result.error.code || HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: result.error.message,
      });
    }

    return response[HttpStatus.OK](res, {
      message: 'Temporary role revoked successfully',
    });
  }

  @Post('temp-roles/cleanup')
  @HttpCode(HttpStatus.OK)
  async cleanupExpiredTempRoles(@Res() res: Response) {
    const result = await this.rbacService.cleanupExpiredTempRoles();

    if (result.error) {
      return response[result.error.code || HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: result.error.message,
      });
    }

    return response[HttpStatus.OK](res, {
      message: `Cleanup completed. ${result.data} expired temporary roles cleaned up.`,
      data: { cleanedCount: result.data },
    });
  }

  // ===========================================
  // ROLE MATRIX MANAGEMENT
  // ===========================================

  @Get('role-matrices/active')
  async getActiveRoleMatrix(@Res() res: Response): Promise<any> {
    const result = await this.roleMatrixService.getActiveRoleMatrix();

    if (result.error) {
      return response[result.error.code || HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: result.error.message,
      });
    }

    const matrix = result.data;
    const mapped = matrix
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
      : undefined;

    return response[HttpStatus.OK](res, {
      message: validationMessage('Role matrix')[200](),
      data: mapped,
    });
  }

  @Get('role-matrices/:version')
  async getRoleMatrixByVersion(@Res() res: Response, @Param('version') version: string): Promise<any> {
    const result = await this.roleMatrixService.getRoleMatrixByVersion(version);

    if (result.error) {
      return response[result.error.code || HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: result.error.message,
      });
    }

    const matrix = result.data;
    const mapped = matrix
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
      : undefined;

    return response[HttpStatus.OK](res, {
      message: validationMessage('Role matrix')[200](),
      data: mapped,
    });
  }

  @Get('role-matrices')
  async listRoleMatrices(
    @Res() res: Response,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ): Promise<any> {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 50;
    const result = await this.roleMatrixService.listRoleMatrices(pageNum, limitNum, status as any);

    if (result.error) {
      return response[result.error.code || HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: result.error.message,
      });
    }

    return response[HttpStatus.OK](res, {
      message: validationMessage('Role matrices')[200](),
      data: result.data,
    });
  }

  @Post('role-matrices')
  @HttpCode(HttpStatus.CREATED)
  async createRoleMatrix(
    @Res() res: Response,
    @Body() dto: CreateRoleMatrixDto,
    @Headers('x-user-id') userId: string,
  ): Promise<any> {
    const createdBy = userId || 'SYSTEM';
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

    if (result.error) {
      return response[result.error.code || HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: result.error.message,
      });
    }

    const data = result.data!;
    return response[HttpStatus.CREATED](res, {
      message: validationMessage('Role matrix')[201](),
      data: {
        id: data.id,
        version: data.version,
        name: data.name,
        description: data.description,
        status: data.status,
        permissionHash: data.permissionHash,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo,
        editorId: data.editorId,
        reviewerId: data.reviewerId,
        reviewedAt: data.reviewedAt,
      },
    });
  }

  @Post('role-matrices/:roleMatrixId/publish')
  @HttpCode(HttpStatus.OK)
  async publishRoleMatrix(
    @Res() res: Response,
    @Param('roleMatrixId') roleMatrixId: string,
    @Body() dto: PublishRoleMatrixDto,
    @Headers('x-user-id') userId: string,
  ): Promise<any> {
    const reviewerId = userId || dto.reviewerId;
    const result = await this.roleMatrixService.publishRoleMatrix(
      {
        roleMatrixId,
        reviewerId,
      },
      reviewerId,
    );

    if (result.error) {
      return response[result.error.code || HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: result.error.message,
      });
    }

    const data = result.data!;
    return response[HttpStatus.OK](res, {
      message: validationMessage('Role matrix')[200](),
      data: {
        id: data.id,
        version: data.version,
        name: data.name,
        description: data.description,
        status: data.status,
        permissionHash: data.permissionHash,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo,
        editorId: data.editorId,
        reviewerId: data.reviewerId,
        reviewedAt: data.reviewedAt,
      },
    });
  }

  @Get('role-matrices/:roleMatrixId/mappings')
  async getRoleMatrixMappings(@Res() res: Response, @Param('roleMatrixId') roleMatrixId: string): Promise<any> {
    const result = await this.roleMatrixService.getRoleMatrixMappings(roleMatrixId);

    if (result.error) {
      return response[result.error.code || HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: result.error.message,
      });
    }

    const mappings = result.data!;
    const mapped = mappings.map((mapping) => ({
      id: mapping.id,
      roleId: mapping.roleId,
      role: {
        id: mapping.role.id,
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

    return response[HttpStatus.OK](res, {
      message: validationMessage('Mappings')[200](),
      data: mapped,
    });
  }

  // ===========================================
  // SOD RULES MANAGEMENT
  // ===========================================

  @Post('sod-rules')
  @HttpCode(HttpStatus.CREATED)
  async createSoDRule(
    @Res() res: Response,
    @Body() dto: CreateSoDRuleDto,
    @Headers('x-user-id') userId: string,
  ): Promise<any> {
    const createdBy = userId || 'SYSTEM';
    const result = await this.sodService.createSoDRule(
      {
        name: dto.name,
        description: dto.description,
        primaryRoleId: dto.primaryRoleId,
        conflictingRoleId: dto.conflictingRoleId,
      },
      createdBy,
    );

    if (result.error) {
      return response[result.error.code || HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: result.error.message,
      });
    }

    const data = result.data!;
    return response[HttpStatus.CREATED](res, {
      message: validationMessage('SoD rule')[201](),
      data: {
        id: data.id,
        name: data.name,
        description: data.description,
        primaryRole: data.role,
        conflictingRole: data.conflictingRole,
        isActive: data.isActive,
      },
    });
  }

  @Get('sod-rules')
  async getActiveSoDRules(@Res() res: Response): Promise<any> {
    const result = await this.sodService.getActiveSoDRules();

    if (result.error) {
      return response[result.error.code || HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: result.error.message,
      });
    }

    return response[HttpStatus.OK](res, {
      message: validationMessage('SoD rules')[200](),
      data: result.data,
    });
  }

  @Post('validate-roles')
  @HttpCode(HttpStatus.OK)
  async validateRoles(@Res() res: Response, @Body() body: { roles: string[] }): Promise<any> {
    const roles = body.roles as any[];
    const result = await this.sodService.validateRoles(roles);

    if (result.error) {
      return response[result.error.code || HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: result.error.message,
      });
    }

    return response[HttpStatus.OK](res, {
      message: validationMessage('Validation')[200](),
      data: result.data,
    });
  }

  @Get('sod-violations')
  async getAllSoDViolations(@Res() res: Response, @Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit) : 100;
    const result = await this.sodService.getAllSoDViolations(limitNum);

    if (result.error) {
      return response[result.error.code || HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: result.error.message,
      });
    }

    return response[HttpStatus.OK](res, {
      message: validationMessage('SoD violations')[200](),
      data: result.data,
    });
  }
}
