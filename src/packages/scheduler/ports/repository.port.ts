import { AuditSync, HRISSyncResult, SyncBatch, SyncBatchStatus, SyncRunType, SyncSummary } from '../domain/types';

export interface SchedulerRepositoryPort {
  // Batch operations
  createBatch(runType: SyncRunType, createdBy: string, totalRecords?: number): Promise<SyncBatch>;

  updateBatchStatus(
    batchId: string,
    status: SyncBatchStatus,
    processedRecords?: number,
    errorDetails?: string[],
    updatedBy?: string,
  ): Promise<SyncBatch>;

  completeBatch(
    batchId: string,
    processedRecords: number,
    insertedRecords: number,
    updatedRecords: number,
    deactivatedRecords: number,
    errorRecords: number,
    errorDetails?: string[],
    updatedBy?: string,
  ): Promise<SyncBatch>;

  failBatch(batchId: string, errorDetails: string[], updatedBy?: string): Promise<SyncBatch>;

  rollbackBatch(batchId: string, reason: string, updatedBy?: string): Promise<SyncBatch>;

  getBatchById(batchId: string): Promise<SyncBatch | null>;

  getLatestBatch(): Promise<SyncBatch | null>;

  getRunningBatch(): Promise<SyncBatch | null>;

  getBatches(limit?: number, offset?: number, status?: SyncBatchStatus): Promise<SyncBatch[]>;

  // Audit operations
  createAuditLog(auditLog: Omit<AuditSync, 'id' | 'timestamp'>): Promise<AuditSync>;

  createAuditLogs(auditLogs: Omit<AuditSync, 'id' | 'timestamp'>[]): Promise<AuditSync[]>;

  getAuditLogsByBatch(batchId: string): Promise<AuditSync[]>;

  // Organization Unit operations
  syncOrganizationUnits(
    batchId: string,
    hrisData: HRISSyncResult,
    createdBy: string,
  ): Promise<{
    inserted: number;
    updated: number;
    deactivated: number;
    errors: Array<{ code: string; name: string; error: string }>;
  }>;

  validateHierarchyCycles(organizationUnits: any[]): Promise<{
    isValid: boolean;
    cycles: Array<{ cycle: string[]; description: string }>;
    warnings: string[];
  }>;

  updateApproverMappings(
    batchId: string,
    createdBy: string,
  ): Promise<{
    updated: number;
    errors: Array<{ employeeId: string; error: string }>;
  }>;

  syncEmployees(
    batchId: string,
    hrisEmployees: Array<{
      employeeId: string;
      fullName: string;
      email?: string;
      orgUnitCode: string;
      statusAktif: boolean;
      effectiveRoles?: string[];
      immediateSupervisor?: string | null;
      immediateManager?: string | null;
      position?: string;
      jobFamily?: string;
    }>,
    createdBy: string,
  ): Promise<{
    inserted: number;
    updated: number;
    deactivated: number;
    errors: Array<{ employeeId: string; error: string }>;
  }>;

  deactivateInactiveEmployees(
    batchId: string,
    createdBy: string,
  ): Promise<{
    deactivated: number;
    errors: Array<{ employeeId: string; error: string }>;
  }>;

  // Summary and statistics
  getSyncSummary(): Promise<SyncSummary>;

  getSyncStatistics(days: number): Promise<{
    totalBatches: number;
    successRate: number;
    averageDuration: number;
    errorRate: number;
  }>;

  // Utility operations
  cleanupOldAuditLogs(retentionDays: number): Promise<number>;

  getLastSyncTimestamp(): Promise<Date | null>;
}
