import { ResourceMode, ServiceType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
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

export class PreSubmitBookingSegmentDto {
  @IsString()
  @IsNotEmpty()
  from: string; // Address text (for display)

  @IsString()
  @IsNotEmpty()
  to: string; // Address text (for display)

  @IsString()
  @IsNotEmpty()
  originLatLong: string; // Format: "lat,lng" (e.g., "-6.2088,106.8456")

  @IsString()
  @IsNotEmpty()
  destinationLatLong: string; // Format: "lat,lng"

  @IsOptional()
  @IsString()
  originNote?: string;

  @IsOptional()
  @IsString()
  destinationNote?: string;
}

export class FindCandidatesPreSubmitDto {
  @IsDateString()
  @IsNotEmpty()
  startAt: string; // ISO 8601 string

  @IsDateString()
  @IsNotEmpty()
  endAt: string; // ISO 8601 string

  @IsInt()
  @Min(1)
  @IsNotEmpty()
  passengerCount: number;

  @IsObject()
  @ValidateNested()
  @Type(() => PreSubmitBookingSegmentDto)
  segment: PreSubmitBookingSegmentDto;

  @IsOptional()
  @IsString()
  requesterId?: string; // Optional: to exclude own bookings from candidates
}
