import { VehicleStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryVehicleDto {
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
  licensePlate?: string;

  @IsOptional()
  @IsString()
  brandModel?: string;

  @IsOptional()
  @IsString()
  vehicleType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  vendorId?: number;

  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orgUnitId?: number; // Filter vehicles available for this organization (dedicated + pool)
}
