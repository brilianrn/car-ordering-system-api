import { SyncBatchStatus, SyncRunType } from '../domain/types';

export class SyncBatchDto {
  id: string;
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
  duration?: number; // in milliseconds
}

export class SyncSummaryDto {
  lastSyncBatch?: SyncBatchDto;
  totalBatches: number;
  successRate: number; // percentage
  averageDuration: number; // in milliseconds
  lastSyncStatus: SyncBatchStatus;
  nextScheduledRun?: Date;
}
