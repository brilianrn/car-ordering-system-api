import { ResourceMode } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateIf } from 'class-validator';

export class AssignBookingDto {
  @IsOptional()
  @ValidateIf((o) => o.resourceMode === 'INTERNAL')
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(1)
  vehicleChosenId?: number;

  @IsOptional()
  @ValidateIf((o) => o.resourceMode === 'INTERNAL')
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(1)
  driverChosenId?: number;

  @IsOptional()
  @ValidateIf((o) => o.resourceMode === 'DAILY_RENT')
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(1)
  vendorChosenId?: number;

  @IsOptional()
  @ValidateIf((o) => o.resourceMode === 'DAILY_RENT')
  @IsNotEmpty()
  @Type(() => Number)
  @Min(0)
  vendorDailyRate?: number;

  @IsOptional()
  @Type(() => Number)
  estimatedTariff?: number;

  @IsOptional()
  @IsString()
  externalDriverName?: string;

  @IsOptional()
  @IsString()
  externalVehiclePlate?: string;

  @IsOptional()
  @IsString()
  dispatchNote?: string;

  @IsEnum(ResourceMode)
  @IsNotEmpty()
  resourceMode: ResourceMode;
}
