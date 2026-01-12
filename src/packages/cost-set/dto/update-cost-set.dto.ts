import { CostSetEnvironment, CostSetScope } from '@prisma/client';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateCostItemDto } from './create-cost-item.dto';

export class UpdateCostSetDto {
  @IsDateString()
  @IsOptional()
  effectiveFrom?: string; // ISO 8601 date string

  @IsDateString()
  @IsOptional()
  effectiveTo?: string; // ISO 8601 date string, optional end date

  @IsEnum(CostSetEnvironment)
  @IsOptional()
  environment?: CostSetEnvironment;

  @IsEnum(CostSetScope)
  @IsOptional()
  scope?: CostSetScope;

  @IsString()
  @IsOptional()
  notes?: string; // Alasan perubahan

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateCostItemDto)
  items?: CreateCostItemDto[]; // Array of cost items (optional, untuk update items)
}
