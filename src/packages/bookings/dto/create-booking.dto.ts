import { ResourceMode, ServiceType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class BookingSegmentDto {
  @IsString()
  @IsNotEmpty()
  from: string; // Address text (for display)

  @IsString()
  @IsNotEmpty()
  to: string; // Address text (for display)

  @IsString()
  @IsNotEmpty()
  originLatLong: string; // Format: "lat,lng" (e.g., "-6.2088,106.8456") - from FE

  @IsString()
  @IsNotEmpty()
  destinationLatLong: string; // Format: "lat,lng" - from FE

  @IsOptional()
  @IsString()
  originNote?: string; // Detail lokasi origin (e.g., "Lobby Utama")

  @IsOptional()
  @IsString()
  destinationNote?: string; // Detail lokasi destination
}

export class CreateBookingDto {
  @IsInt()
  @IsNotEmpty()
  categoryId: number;

  @IsString()
  @IsNotEmpty()
  purpose: string;

  @IsDateString()
  @IsNotEmpty()
  startAt: string;

  @IsDateString()
  @IsNotEmpty()
  endAt: string;

  @IsInt()
  @Min(1)
  passengerCount: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  passengerNames?: string[]; // Array of passenger names

  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @IsEnum(ResourceMode)
  resourceMode: ResourceMode;

  @IsObject()
  @ValidateNested()
  @Type(() => BookingSegmentDto)
  segment: BookingSegmentDto;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  vehicleId?: number; // Optional: Preferred vehicle ID (will be validated for availability)

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isDraft?: boolean; // Default: false (submit). If true, booking will be saved as DRAFT without approval header
}
