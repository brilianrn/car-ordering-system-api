import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { SyncBatch, SyncOperationResult, SyncRunType, SyncSummary } from '../domain/types';
import { SyncSummaryDto, SyncTriggerDto } from '../dto';

export interface SchedulerUsecasePort {
  // Manual sync trigger
  triggerSync(dto: SyncTriggerDto, userId: string): Promise<IUsecaseResponse<SyncOperationResult>>;

  // Get sync status and history
  getSyncStatus(): Promise<IUsecaseResponse<SyncSummaryDto>>;

  getSyncHistory(limit?: number, offset?: number): Promise<IUsecaseResponse<SyncBatch[]>>;

  // Scheduled sync (called by cron job)
  executeScheduledSync(): Promise<SyncOperationResult>;

  // Utility operations
  getSyncSummary(): Promise<IUsecaseResponse<SyncSummary>>;

  cleanupOldData(retentionDays?: number): Promise<IUsecaseResponse<{ deletedRecords: number }>>;

  rollbackBatch(batchId: string, userId: string): Promise<IUsecaseResponse<boolean>>;
}
