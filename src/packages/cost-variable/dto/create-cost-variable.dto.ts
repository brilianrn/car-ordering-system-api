import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CostCategory {
  FUEL = 'FUEL',
  TOLL = 'TOLL',
  PARKING = 'PARKING',
  DRIVER = 'DRIVER',
  VEHICLE_MAINTENANCE = 'VEHICLE_MAINTENANCE',
  OTHER = 'OTHER',
}

export enum CostUnit {
  KM = 'KM', // Per kilometer
  HOUR = 'HOUR', // Per hour
  TRIP = 'TRIP', // Per trip
  FIXED = 'FIXED', // Fixed amount
  DAY = 'DAY', // Per day
}

export class CreateCostVariableDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9_]+$/, { message: 'code must be uppercase alphanumeric with underscores' })
  code?: string; // Optional: Unique code, e.g., "FUEL_RATE", "TOLL_RATE", "PARKING_RATE". If not provided, will be auto-generated.

  @IsString()
  @IsNotEmpty()
  name: string; // Display name, e.g., "Fuel Rate per KM", "Toll Rate"

  @IsEnum(CostCategory)
  @IsNotEmpty()
  category: CostCategory; // FUEL, TOLL, PARKING, DRIVER, VEHICLE_MAINTENANCE, OTHER

  @IsEnum(CostUnit)
  @IsNotEmpty()
  unit: CostUnit; // KM, HOUR, TRIP, FIXED, DAY

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(0)
  value: number; // Cost value

  @IsOptional()
  @IsString()
  currency?: string; // Default: IDR

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean; // Default: true

  @IsDateString()
  @IsNotEmpty()
  effectiveFrom: string; // ISO date string, when this cost variable becomes effective

  @IsOptional()
  @IsDateString()
  effectiveTo?: string; // ISO date string, optional end date

  @IsOptional()
  @IsString()
  description?: string; // Optional description

  @IsOptional()
  metadata?: any; // Additional configuration (e.g., vehicle type specific rates)
}
