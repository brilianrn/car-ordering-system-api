import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum ApprovalLevel {
  L1 = 'L1', // Supervisor approval
  L2 = 'L2', // GA assignment
  ALL = 'ALL', // Both L1 and L2
}

export class QueryApprovalListDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsEnum(ApprovalLevel)
  level?: ApprovalLevel;

  @IsOptional()
  @IsString()
  search?: string; // Search by booking number or purpose

  @IsOptional()
  @IsString()
  approverId?: string; // Filter by approver L1 ID (for L1 approval list)
}
