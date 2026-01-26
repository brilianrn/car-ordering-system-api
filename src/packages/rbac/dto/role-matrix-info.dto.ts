import { RBACStatus } from '../domain/types';

export class RoleMatrixInfoDto {
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

export class RoleMatrixMappingDto {
  id: string;
  roleId: string;
  role: RoleInfoDto;
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

export class RoleInfoDto {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  level: number;
  isActive: boolean;
}
