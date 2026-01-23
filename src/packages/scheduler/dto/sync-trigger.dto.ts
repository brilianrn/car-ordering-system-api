import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SyncRunType } from '../domain/types';

export class SyncTriggerDto {
  @IsOptional()
  @IsEnum(SyncRunType)
  runType?: SyncRunType = SyncRunType.DELTA;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  triggeredBy?: string;
}
