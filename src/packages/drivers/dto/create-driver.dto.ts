import { DriverType, RealtimeStatus, TransmissionType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateDriverDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]+$/, {
    message: 'driverCode must be uppercase alphanumeric',
  })
  driverCode?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  fullName: string;

  @IsOptional()
  @IsString()
  internalNik?: string;

  @IsEnum(DriverType)
  driverType: DriverType;

  @IsOptional()
  @IsInt()
  vendorId?: number;

  @IsString()
  @IsNotEmpty()
  simNumber: string;

  @IsDateString()
  simExpiry: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsEnum(TransmissionType)
  transmissionPref: TransmissionType;

  @IsString()
  @IsNotEmpty()
  plantLocation: string;

  @IsOptional()
  @IsBoolean()
  isDedicated?: boolean;

  @IsOptional()
  @IsEnum(RealtimeStatus)
  realtimeStatus?: RealtimeStatus;

  @IsOptional()
  @IsInt()
  photoAssetId?: number;

  @IsOptional()
  @IsInt()
  ktpAssetId?: number;

  @IsOptional()
  @IsInt()
  simAssetId?: number;
}
