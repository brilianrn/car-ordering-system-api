import { Injectable, Logger } from '@nestjs/common';
import { clientDb } from '../../../shared/utils';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import {
  RoleMatrixInfo,
  RoleMatrixMapping,
  CreateRoleMatrixRequest,
  PublishRoleMatrixRequest,
  PermissionHash,
  RBACError,
  PolicyNotPublishedError,
  RBACStatus,
  PolicyChangeAction,
} from '../domain/types';

@Injectable()
export class RoleMatrixService {
  private readonly logger = new Logger(RoleMatrixService.name);
  private readonly db: PrismaClient = clientDb;

  /**
   * Create a new role matrix version
   */
  async createRoleMatrix(request: CreateRoleMatrixRequest, createdBy: string): Promise<RoleMatrixInfo> {
    try {
      this.logger.log(`Creating role matrix ${request.version} by ${createdBy}`);

      // Validate version format (semantic versioning)
      if (!this.isValidVersion(request.version)) {
        throw new RBACError(
          `Invalid version format: ${request.version}. Use semantic versioning (e.g., v1.0.0)`,
          'INVALID_VERSION',
        );
      }

      // Check if version already exists
      const existing = await this.db.roleMatrix.findUnique({
        where: { version: request.version },
      });

      if (existing) {
        throw new RBACError(`Role matrix version ${request.version} already exists`, 'VERSION_EXISTS');
      }

      // Validate mappings
      await this.validateMappings(request.mappings);

      // Generate permission hash
      const permissionHash = await this.generatePermissionHash(request.mappings);

      // Create role matrix
      const roleMatrix = await this.db.roleMatrix.create({
        data: {
          version: request.version,
          name: request.name,
          description: request.description,
          permissionHash,
          effectiveFrom: request.effectiveFrom,
          effectiveTo: request.effectiveTo,
          createdBy,
          editorId: createdBy,
        },
      });

      // Create mappings
      await this.createMappings(roleMatrix.id, request.mappings, createdBy);

      // Create audit snapshot
      await this.createPolicyAuditSnapshot({
        roleMatrixId: roleMatrix.id,
        action: PolicyChangeAction.CREATE,
        changedBy: createdBy,
        changeReason: `Created role matrix ${request.version}`,
      });

      this.logger.log(`Role matrix ${request.version} created successfully`);
      return this.mapRoleMatrixToDomain(roleMatrix);
    } catch (error) {
      this.logger.error(`Failed to create role matrix: ${error.message}`, error.stack);
      throw error instanceof RBACError
        ? error
        : new RBACError(`Failed to create role matrix: ${error.message}`, 'CREATE_FAILED');
    }
  }

  /**
   * Publish a role matrix (Two-Person Rule)
   */
  async publishRoleMatrix(request: PublishRoleMatrixRequest, reviewerId: string): Promise<RoleMatrixInfo> {
    try {
      this.logger.log(`Publishing role matrix ${request.roleMatrixId} by reviewer ${reviewerId}`);

      const roleMatrix = await this.db.roleMatrix.findUnique({
        where: { id: request.roleMatrixId },
      });

      if (!roleMatrix) {
        throw new RBACError('Role matrix not found', 'MATRIX_NOT_FOUND');
      }

      if (roleMatrix.status !== RBACStatus.DRAFT) {
        throw new RBACError(`Role matrix is already ${roleMatrix.status}`, 'INVALID_STATUS');
      }

      // Two-Person Rule validation
      if (roleMatrix.editorId === reviewerId) {
        throw new RBACError('Editor and reviewer cannot be the same person (Two-Person Rule)', 'SAME_EDITOR_REVIEWER');
      }

      // Check if there's already a published version that would conflict
      const conflictingPublished = await this.db.roleMatrix.findFirst({
        where: {
          status: RBACStatus.PUBLISHED,
          effectiveFrom: { lte: roleMatrix.effectiveTo || new Date('2099-12-31') },
          OR: [
            { effectiveTo: { gte: roleMatrix.effectiveFrom } },
            { effectiveTo: null },
          ],
          id: { not: roleMatrix.id },
        },
      });

      if (conflictingPublished) {
        throw new RBACError(
          `Cannot publish: conflicts with published version ${conflictingPublished.version}`,
          'CONFLICTING_VERSION',
        );
      }

      // Publish the role matrix
      const updatedMatrix = await this.db.roleMatrix.update({
        where: { id: request.roleMatrixId },
        data: {
          status: RBACStatus.PUBLISHED,
          reviewerId,
          reviewedAt: new Date(),
          updatedBy: reviewerId,
        },
      });

      // Create audit snapshot
      await this.createPolicyAuditSnapshot({
        roleMatrixId: updatedMatrix.id,
        action: PolicyChangeAction.PUBLISH,
        changedBy: reviewerId,
        changeReason: `Published role matrix ${updatedMatrix.version}`,
      });

      this.logger.log(`Role matrix ${updatedMatrix.version} published successfully`);
      return this.mapRoleMatrixToDomain(updatedMatrix);
    } catch (error) {
      this.logger.error(`Failed to publish role matrix: ${error.message}`, error.stack);
      throw error instanceof RBACError
        ? error
        : new RBACError(`Failed to publish role matrix: ${error.message}`, 'PUBLISH_FAILED');
    }
  }

  /**
   * Get active role matrix
   */
  async getActiveRoleMatrix(): Promise<RoleMatrixInfo | null> {
    try {
      const activeMatrix = await this.db.roleMatrix.findFirst({
        where: {
          status: RBACStatus.PUBLISHED,
          effectiveFrom: { lte: new Date() },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      });

      return activeMatrix ? this.mapRoleMatrixToDomain(activeMatrix) : null;
    } catch (error) {
      this.logger.error(`Failed to get active role matrix: ${error.message}`, error.stack);
      throw new RBACError(`Failed to get active role matrix: ${error.message}`, 'GET_ACTIVE_FAILED');
    }
  }

  /**
   * Get role matrix by version
   */
  async getRoleMatrixByVersion(version: string): Promise<RoleMatrixInfo | null> {
    try {
      const matrix = await this.db.roleMatrix.findUnique({
        where: { version },
      });

      return matrix ? this.mapRoleMatrixToDomain(matrix) : null;
    } catch (error) {
      this.logger.error(`Failed to get role matrix ${version}: ${error.message}`, error.stack);
      throw new RBACError(`Failed to get role matrix ${version}: ${error.message}`, 'GET_MATRIX_FAILED');
    }
  }

  /**
   * List all role matrices with pagination
   */
  async listRoleMatrices(status?: RBACStatus, limit: number = 50, offset: number = 0): Promise<RoleMatrixInfo[]> {
    try {
      const matrices = await this.db.roleMatrix.findMany({
        where: status ? { status } : {},
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      return matrices.map((m) => this.mapRoleMatrixToDomain(m));
    } catch (error) {
      this.logger.error(`Failed to list role matrices: ${error.message}`, error.stack);
      throw new RBACError(`Failed to list role matrices: ${error.message}`, 'LIST_FAILED');
    }
  }

  /**
   * Get mappings for a role matrix
   */
  async getRoleMatrixMappings(roleMatrixId: string): Promise<RoleMatrixMapping[]> {
    try {
      const mappings = await this.db.roleMatrixMapping.findMany({
        where: { roleMatrixId },
        include: { role: true },
        orderBy: { priority: 'desc' },
      });

      return mappings.map((m) => this.mapMappingToDomain(m));
    } catch (error) {
      this.logger.error(`Failed to get mappings for matrix ${roleMatrixId}: ${error.message}`, error.stack);
      throw new RBACError(`Failed to get mappings: ${error.message}`, 'GET_MAPPINGS_FAILED');
    }
  }

  /**
   * Retire a role matrix
   */
  async retireRoleMatrix(roleMatrixId: string, retiredBy: string, reason: string): Promise<void> {
    try {
      const matrix = await this.db.roleMatrix.findUnique({
        where: { id: roleMatrixId },
      });

      if (!matrix) {
        throw new RBACError('Role matrix not found', 'MATRIX_NOT_FOUND');
      }

      if (matrix.status !== RBACStatus.PUBLISHED) {
        throw new RBACError('Only published matrices can be retired', 'INVALID_STATUS');
      }

      await this.db.roleMatrix.update({
        where: { id: roleMatrixId },
        data: {
          status: RBACStatus.RETIRED,
          effectiveTo: new Date(),
          updatedBy: retiredBy,
        },
      });

      // Create audit snapshot
      await this.createPolicyAuditSnapshot({
        roleMatrixId,
        action: PolicyChangeAction.RETIRE,
        changedBy: retiredBy,
        changeReason: `Retired role matrix ${matrix.version}: ${reason}`,
      });

      this.logger.log(`Role matrix ${matrix.version} retired by ${retiredBy}`);
    } catch (error) {
      this.logger.error(`Failed to retire role matrix: ${error.message}`, error.stack);
      throw error instanceof RBACError
        ? error
        : new RBACError(`Failed to retire role matrix: ${error.message}`, 'RETIRE_FAILED');
    }
  }

  /**
   * Validate if a version string follows semantic versioning
   */
  private isValidVersion(version: string): boolean {
    const semverRegex = /^v?\d+\.\d+\.\d+(-[\w\.\-]+)?(\+[\w\.\-]+)?$/;
    return semverRegex.test(version);
  }

  /**
   * Validate role matrix mappings
   */
  private async validateMappings(mappings: CreateRoleMatrixRequest['mappings']): Promise<void> {
    const errors: string[] = [];

    for (let i = 0; i < mappings.length; i++) {
      const mapping = mappings[i];

      // Check if role exists and is active
      const role = await this.db.rBACRole.findUnique({
        where: { id: mapping.roleId },
      });

      if (!role) {
        errors.push(`Mapping ${i + 1}: Role ${mapping.roleId} not found`);
        continue;
      }

      if (!role.isActive) {
        errors.push(`Mapping ${i + 1}: Role ${role.name} is not active`);
      }

      // Validate that at least one matching criteria is provided
      const hasCriteria = !!(
        mapping.orgUnitCode ||
        mapping.orgUnitPattern ||
        mapping.division ||
        mapping.department ||
        mapping.costCenter ||
        mapping.position ||
        mapping.positionPattern ||
        mapping.jobFamily ||
        mapping.jobFamilyPattern
      );

      if (!hasCriteria) {
        errors.push(`Mapping ${i + 1}: At least one matching criteria must be provided`);
      }
    }

    if (errors.length > 0) {
      throw new RBACError(`Validation failed: ${errors.join('; ')}`, 'INVALID_MAPPINGS');
    }
  }

  /**
   * Generate permission hash for change detection
   */
  private async generatePermissionHash(mappings: CreateRoleMatrixRequest['mappings']): Promise<string> {
    // Get all unique role IDs
    const roleIds = [...new Set(mappings.map((m) => m.roleId))];

    // Get permissions for these roles
    const permissions = await this.db.rolePermission.findMany({
      where: {
        roleId: { in: roleIds },
      },
      include: {
        permission: true,
      },
      orderBy: [{ roleId: 'asc' }, { permission: { module: 'asc' } }, { permission: { action: 'asc' } }],
    });

    // Create a canonical representation
    const permissionStrings = permissions.map(
      (p) => `${p.roleId}:${p.permission.module}:${p.permission.action}:${p.permission.resource || ''}`,
    );

    // Generate hash
    const hash = crypto.createHash('sha256');
    hash.update(permissionStrings.join('\n'));
    return hash.digest('hex');
  }

  /**
   * Create mappings for a role matrix
   */
  private async createMappings(
    roleMatrixId: string,
    mappings: CreateRoleMatrixRequest['mappings'],
    createdBy: string,
  ): Promise<void> {
    const mappingData = mappings.map((mapping) => ({
      roleMatrixId,
      roleId: mapping.roleId,
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
      createdBy,
    }));

    await this.db.roleMatrixMapping.createMany({ data: mappingData });
  }

  /**
   * Create audit snapshot for policy changes
   */
  private async createPolicyAuditSnapshot(params: {
    roleMatrixId: string;
    action: PolicyChangeAction;
    changedBy: string;
    changeReason?: string;
  }): Promise<void> {
    const retainUntil = new Date();
    retainUntil.setFullYear(retainUntil.getFullYear() + 5); // 5 years retention

    await this.db.rBACSnapshot.create({
      data: {
        employeeId: 'SYSTEM', // Policy changes are system-level
        snapshotType: 'POLICY_CHANGE',
        action: params.action,
        changeReason: params.changeReason,
        changedBy: params.changedBy,
        policyVersion: params.roleMatrixId, // We'll need to get version separately
        policyChangeAction: params.action,
        retainUntil,
      },
    });
  }

  private mapRoleMatrixToDomain(matrix: any): RoleMatrixInfo {
    return {
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
    };
  }

  private mapMappingToDomain(mapping: any): RoleMatrixMapping {
    return {
      id: mapping.id,
      roleId: mapping.roleId,
      role: {
        id: mapping.role.id,
        name: mapping.role.name,
        displayName: mapping.role.displayName,
        description: mapping.role.description,
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
    };
  }
}
