import { TransmissionType, VehicleStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateVehicleDto {
  @IsOptional()
  @IsString()
  vehicleCode?: string;

  @IsString()
  @IsNotEmpty()
  licensePlate: string;

  @IsOptional()
  @IsInt()
  vendorId?: number;

  @IsString()
  @IsNotEmpty()
  brandModel: string;

  @IsString()
  @IsNotEmpty()
  vehicleType: string;

  @IsInt()
  year: number;

  @IsEnum(TransmissionType)
  transmission: TransmissionType;

  @IsInt()
  @Min(1)
  seatCapacity: number;

  @IsNumber()
  @Min(0)
  fuelConsumption: number;

  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;

  @IsString()
  @IsNotEmpty()
  plantLocation: string;

  @IsOptional()
  @IsString()
  divisionFlag?: string;

  @IsOptional()
  @IsBoolean()
  isDedicated?: boolean;

  @IsOptional()
  @IsInt()
  dedicatedOrgId?: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least 1 image is required' })
  @ArrayMaxSize(3, { message: 'Maximum 3 images allowed' })
  @IsInt({ each: true })
  imageAssetIds: number[];
}
