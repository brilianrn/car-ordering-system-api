import { TransmissionType, VehicleStatus } from '@prisma/client';
import {
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
  @IsString()
  @IsNotEmpty()
  vehicleCode: string;

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
}
