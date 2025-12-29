import { TransmissionType, VehicleStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  vehicleCode?: string;

  @IsOptional()
  @IsString()
  licensePlate?: string;

  @IsOptional()
  @IsInt()
  vendorId?: number;

  @IsOptional()
  @IsString()
  brandModel?: string;

  @IsOptional()
  @IsString()
  vehicleType?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsEnum(TransmissionType)
  transmission?: TransmissionType;

  @IsOptional()
  @IsInt()
  @Min(1)
  seatCapacity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fuelConsumption?: number;

  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;

  @IsOptional()
  @IsString()
  plantLocation?: string;

  @IsOptional()
  @IsString()
  divisionFlag?: string;

  @IsOptional()
  @IsBoolean()
  isDedicated?: boolean;

  @IsOptional()
  @IsInt()
  dedicatedOrgId?: number; // Required if isDedicated is true

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'At least 1 image is required' })
  @ArrayMaxSize(3, { message: 'Maximum 3 images allowed' })
  @IsInt({ each: true })
  imageAssetIds?: number[];
}
