import { CostSetEnvironment, CostSetScope, CostSetStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class QueryCostSetDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(CostSetStatus)
  status?: CostSetStatus; // Filter by status

  @IsOptional()
  @IsEnum(CostSetEnvironment)
  environment?: CostSetEnvironment; // Filter by environment

  @IsOptional()
  @IsEnum(CostSetScope)
  scope?: CostSetScope; // Filter by scope

  @IsOptional()
  @IsDateString()
  effectiveDate?: string; // Filter by effective date (untuk snapshot logic)
}
