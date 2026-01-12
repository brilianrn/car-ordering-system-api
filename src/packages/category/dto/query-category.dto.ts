import { CategoryScope, CategoryStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryCategoryDto {
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
  @IsString()
  search?: string; // Search by code or name

  @IsOptional()
  @IsEnum(CategoryStatus)
  status?: CategoryStatus; // Filter by status

  @IsOptional()
  @IsEnum(CategoryScope)
  scope?: CategoryScope; // Filter by scope

  @IsOptional()
  @IsString()
  orgUnitCode?: string; // For scope filtering (Divisi GA, etc.)
}
