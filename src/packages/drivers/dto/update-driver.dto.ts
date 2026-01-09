import { DriverType, RealtimeStatus, TransmissionType } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateDriverDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @IsString()
  simNumber?: string;

  @IsOptional()
  @IsDateString()
  simExpiry?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsEnum(TransmissionType)
  transmissionPref?: TransmissionType;

  @IsOptional()
  @IsString()
  plantLocation?: string;

  @IsOptional()
  @IsEnum(RealtimeStatus)
  realtimeStatus?: RealtimeStatus;

  @IsOptional()
  @IsBoolean()
  isDedicated?: boolean;

  @IsOptional()
  @IsEnum(DriverType)
  driverType?: DriverType;

  @IsOptional()
  @IsInt()
  vendorId?: number;

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
