import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { CostCategory } from './create-cost-variable.dto';

export class QueryCostVariableDto {
  @IsOptional()
  @Type(() => Number)
  page?: number; // Default: 1

  @IsOptional()
  @Type(() => Number)
  limit?: number; // Default: 10

  @IsOptional()
  @IsString()
  search?: string; // Search by code or name

  @IsOptional()
  @IsEnum(CostCategory)
  category?: CostCategory; // Filter by category

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean; // Filter by active status
}

