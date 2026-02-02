import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum SyncRunType {
  FULL = 'FULL',
  DELTA = 'DELTA',
  MANUAL = 'MANUAL',
}

export class SyncOrgUnitsDto {
  @IsEnum(SyncRunType)
  runType: SyncRunType = SyncRunType.MANUAL;

  @IsOptional()
  @IsString()
  notes?: string;
}

export interface ISyncOrgUnitsResponse {
  batchId: string;
  status: string;
  message: string;
}
