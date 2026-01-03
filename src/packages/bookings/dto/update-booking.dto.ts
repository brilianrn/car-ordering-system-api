import { ResourceMode, ServiceType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class BookingSegmentDto {
  @IsString()
  @IsOptional()
  from?: string; // Address text (for display)

  @IsString()
  @IsOptional()
  to?: string; // Address text (for display)

  @IsString()
  @IsOptional()
  originLatLong?: string; // Format: "lat,lng" (e.g., "-6.2088,106.8456") - from FE

  @IsString()
  @IsOptional()
  destinationLatLong?: string; // Format: "lat,lng" - from FE

  @IsOptional()
  @IsString()
  originNote?: string; // Detail lokasi origin (e.g., "Lobby Utama")

  @IsOptional()
  @IsString()
  destinationNote?: string; // Detail lokasi destination
}

export class UpdateBookingDto {
  @IsOptional()
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsDateString()
  startAt?: string; // ISO 8601 string

  @IsOptional()
  @IsDateString()
  endAt?: string; // ISO 8601 string

  @IsOptional()
  @IsInt()
  @Min(1)
  passengerCount?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  passengerNames?: string[]; // Array of passenger names

  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType; // 'DROP' | 'PICKUP' | 'BOTH'

  @IsOptional()
  @IsEnum(ResourceMode)
  resourceMode?: ResourceMode; // 'INTERNAL' | 'DAILY_RENT' | 'PERSONAL'

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BookingSegmentDto)
  segment?: BookingSegmentDto;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  vehicleId?: number; // Optional: Preferred vehicle ID (will be validated for availability)

  @IsOptional()
  @IsString()
  additionalNotes?: string; // Optional - additional notes (stored in purpose field or can be added to schema later)

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isDraft?: boolean; // Optional - if true, keeps as DRAFT. If false, submits booking (changes status to SUBMITTED and creates approval header)
}
