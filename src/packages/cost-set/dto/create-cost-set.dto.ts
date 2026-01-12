import { CostSetEnvironment, CostSetScope } from '@prisma/client';
import { IsArray, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateCostItemDto } from './create-cost-item.dto';

export class CreateCostSetDto {
  @IsDateString()
  @IsNotEmpty()
  effectiveFrom: string; // ISO 8601 date string

  @IsDateString()
  @IsOptional()
  effectiveTo?: string; // ISO 8601 date string, optional end date

  @IsEnum(CostSetEnvironment)
  @IsOptional()
  environment?: CostSetEnvironment = CostSetEnvironment.UAT; // Default: UAT

  @IsEnum(CostSetScope)
  @IsOptional()
  scope?: CostSetScope = CostSetScope.GLOBAL; // Default: GLOBAL

  @IsString()
  @IsOptional()
  notes?: string; // Alasan perubahan

  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateCostItemDto)
  items: CreateCostItemDto[]; // Array of cost items
}
