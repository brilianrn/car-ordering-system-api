import {
    RBACSnapshot,
    RoleMatrixInfo,
    SoDRuleInfo
} from './types';

/**
 * User List Item
 */
export interface IUserListItem {
  employeeId: string;
  fullName: string;
  email: string | null;
  position: string | null;
  department: string;
  isActive: boolean;
  roles: {
    id: string;
    name: string;
    displayName: string;
  }[];
  tempRoles: {
    id: string;
    name: string;
    displayName: string;
    expiresAt: Date;
  }[];
}

/**
 * User List Response
 */
export interface IUserListResponse {
  data: IUserListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

/**
 * Audit Log List Response
 */
export interface IAuditLogListResponse {
  data: RBACSnapshot[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

/**
 * Role Matrix List Response
 */
export interface IRoleMatrixListResponse {
  data: RoleMatrixInfo[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

/**
 * SoD Rule List Response
 */
export interface ISoDRuleListResponse {
  data: SoDRuleInfo[];
}

/**
 * SoD Violation List Item
 */
export interface ISoDViolationListItem {
  employeeId: string;
  employeeName: string;
  violations: SoDRuleInfo[];
}

/**
 * SoD Violation List Response
 */
export interface ISoDViolationListResponse {
  data: ISoDViolationListItem[];
}
