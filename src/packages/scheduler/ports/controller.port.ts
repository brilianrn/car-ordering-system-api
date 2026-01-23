import { Response } from 'express';
import { ResponseREST } from '@/shared/utils/rest-api/types';
import { SyncBatch, SyncSummary } from '../domain/types';
import { SyncSummaryDto, SyncTriggerDto } from '../dto';

export interface SchedulerControllerPort {
  triggerSync(dto: SyncTriggerDto, userId: string, res: Response): Promise<Response<ResponseREST<any>>>;

  getSyncStatus(userId: string, res: Response): Promise<Response<ResponseREST<SyncSummaryDto>>>;

  getSyncHistory(
    query: { limit?: number; offset?: number },
    userId: string,
    res: Response,
  ): Promise<Response<ResponseREST<SyncBatch[]>>>;

  getSyncSummary(userId: string, res: Response): Promise<Response<ResponseREST<SyncSummary>>>;

  cleanupOldData(
    query: { retentionDays?: number },
    userId: string,
    res: Response,
  ): Promise<Response<ResponseREST<{ deletedRecords: number }>>>;
}
