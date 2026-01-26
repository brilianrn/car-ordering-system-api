import { RoleMatrixInfo, RoleMatrixMapping, CreateRoleMatrixRequest, PublishRoleMatrixRequest } from '../domain/types';
import { RBACStatus } from '@prisma/client';

export interface RoleMatrixServicePort {
  // Matrix management
  createRoleMatrix(request: CreateRoleMatrixRequest, createdBy: string): Promise<RoleMatrixInfo>;
  publishRoleMatrix(request: PublishRoleMatrixRequest, reviewerId: string): Promise<RoleMatrixInfo>;
  retireRoleMatrix(roleMatrixId: string, retiredBy: string, reason: string): Promise<void>;

  // Matrix retrieval
  getActiveRoleMatrix(): Promise<RoleMatrixInfo | null>;
  getRoleMatrixByVersion(version: string): Promise<RoleMatrixInfo | null>;
  listRoleMatrices(status?: RBACStatus, limit?: number, offset?: number): Promise<RoleMatrixInfo[]>;

  // Mappings
  getRoleMatrixMappings(roleMatrixId: string): Promise<RoleMatrixMapping[]>;
}
