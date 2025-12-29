import { ResourceMode, ServiceType } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BookingSegmentDto {
  @IsString()
  @IsNotEmpty()
  from: string;

  @IsString()
  @IsNotEmpty()
  to: string;
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
}
