import { Prisma } from '@prisma/client';

// Base types for HRIS data synchronization
export interface HRISOrganizationUnit {
  code: string;
  name: string;
  parentCode?: string;
  costCenter?: string;
  statusAktif: boolean;
  type: string;
  lastModified: Date;
}

export interface HRISEmployee {
  employeeId: string;
  fullName: string;
  email?: string;
  orgUnitCode: string;
  statusAktif: boolean;
  lastModified: Date;
  effectiveRoles?: string[];
  immediateSupervisor?: string | null;
  immediateManager?: string | null;
  position?: string;
  jobFamily?: string;
}

export interface HRISSyncResult {
  organizations: HRISOrganizationUnit[];
  employees: HRISEmployee[];
  totalRecords: number;
  lastSyncTimestamp: Date;
  isValidData: boolean; // Indicates if data is valid or fallback empty data due to error
}

// Sync batch status enumeration
export enum SyncBatchStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  DONE = 'DONE',
  FAIL = 'FAIL',
  ROLLBACK = 'ROLLBACK',
}

// Sync run type enumeration
export enum SyncRunType {
  FULL = 'FULL',
  DELTA = 'DELTA',
  MANUAL = 'MANUAL',
}

// Sync batch tracking
export interface SyncBatch {
  id: string; // UUID
  runType: SyncRunType;
  startTime: Date;
  endTime?: Date;
  status: SyncBatchStatus;
  totalRecords: number;
  processedRecords: number;
  insertedRecords: number;
  updatedRecords: number;
  deactivatedRecords: number;
  errorRecords: number;
  errorDetails?: string[];
  createdBy: string;
  updatedBy?: string;
  rollbackReason?: string;
}

// Audit sync record for detailed tracking
// Audit entity type enumeration
export enum AuditEntityType {
  ORGANIZATION_UNIT = 'ORGANIZATION_UNIT',
  EMPLOYEE = 'EMPLOYEE',
  APPROVER_MAPPING = 'APPROVER_MAPPING',
}

// Audit action enumeration
export enum AuditAction {
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DEACTIVATE = 'DEACTIVATE',
  REACTIVATE = 'REACTIVATE',
  ERROR = 'ERROR',
}

export interface AuditSync {
  id: string; // UUID
  batchId: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  oldValue?: any;
  newValue?: any;
  errorMessage?: string;
  timestamp: Date;
  createdBy: string;
}

// Sync summary for reporting
export interface SyncSummary {
  batchId: string;
  status: SyncBatchStatus;
  duration: number; // in milliseconds
  totalRecords: number;
  processedRecords: number;
  successRecords: number;
  errorRecords: number;
  errors: string[];
  startTime: Date;
  endTime: Date;
}

// Hierarchy validation result
export interface HierarchyValidation {
  isValid: boolean;
  cycles: Array<{
    cycle: string[];
    description: string;
  }>;
  warnings: string[];
}

// Organization unit sync result
export interface OrganizationSyncResult {
  inserted: number;
  updated: number;
  deactivated: number;
  errors: Array<{
    code: string;
    name: string;
    error: string;
  }>;
}

// Employee sync result (for future expansion)
export interface EmployeeSyncResult {
  inserted: number;
  updated: number;
  deactivated: number;
  errors: Array<{
    employeeId: string;
    error: string;
  }>;
}

// Approver mapping sync result
export interface ApproverMappingResult {
  updated: number;
  errors: Array<{
    employeeId: string;
    error: string;
  }>;
}

// Complete sync operation result
export interface SyncOperationResult {
  batch: SyncBatch;
  organizations: OrganizationSyncResult;
  employees: EmployeeSyncResult;
  approverMappings: ApproverMappingResult;
  hierarchyValidation: HierarchyValidation;
  summary: SyncSummary;
  auditLogs: AuditSync[];
}

// Scheduler configuration
export interface SchedulerConfig {
  cronExpression: string;
  timezone: string;
  retryAttempts: number;
  retryDelay: number; // in milliseconds
  batchTimeout: number; // in milliseconds
  enableRollback: boolean;
}

// HRIS API client configuration
export interface HRISClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  retryAttempts: number;
  rateLimit: {
    requests: number;
    period: number; // in milliseconds
  };
}

// Scheduler context for tracking execution
export interface SchedulerContext {
  batchId: string;
  startTime: Date;
  userId: string;
  config: SchedulerConfig;
  hrisConfig: HRISClientConfig;
}

// Error types for better error handling
export class SchedulerError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
  ) {
    super(message);
    this.name = 'SchedulerError';
  }
}

export class HierarchyCycleError extends SchedulerError {
  constructor(cycles: Array<{ cycle: string[]; description: string }>) {
    super(`Hierarchy cycle detected: ${cycles.map((c) => c.cycle.join(' -> ')).join(', ')}`, 'HIERARCHY_CYCLE', {
      cycles,
    });
    this.name = 'HierarchyCycleError';
  }
}

export class SyncTimeoutError extends SchedulerError {
  constructor(timeout: number) {
    super(`Sync operation timed out after ${timeout}ms`, 'SYNC_TIMEOUT', { timeout });
    this.name = 'SyncTimeoutError';
  }
}

export class HRISConnectionError extends SchedulerError {
  constructor(message: string, details?: any) {
    super(message, 'HRIS_CONNECTION_ERROR', details);
    this.name = 'HRISConnectionError';
  }
}
