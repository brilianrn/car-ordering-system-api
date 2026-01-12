import { CostItemCategory, CostItemUnit, CostSetScope } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCostItemDto {
  @IsEnum(CostItemCategory)
  @IsNotEmpty()
  category: CostItemCategory; // FUEL_PERTALITE, FUEL_SOLAR, TOLL_PER_KM, etc.

  @IsString()
  @IsNotEmpty()
  name: string; // e.g., "Pertalite", "Solar", "Per Km", "Hourly", "Cap", "KM/L per tipe unit", "Markup %", "Pembulatan"

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(0)
  value: number; // Numeric value

  @IsEnum(CostItemUnit)
  @IsNotEmpty()
  unit: CostItemUnit; // IDR_PER_L, IDR_PER_KM, IDR_PER_HOUR, PERCENT, KM_PER_L, IDR

  @IsEnum(CostSetScope)
  @IsOptional()
  scope?: CostSetScope; // Optional: GLOBAL, PLANT, atau DIVISI

  @IsString()
  @IsOptional()
  vehicleType?: string; // Optional: untuk vehicle type specific rates

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  roundingStep?: number; // Optional: step untuk pembulatan (misal: 1000 untuk pembulatan ke ribuan)
}
