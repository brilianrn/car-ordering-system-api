import { BookingStatus, ResourceMode, ServiceType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryBookingDto {
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
  requesterId?: string; // For "My Bookings" filter

  // Filter by booking status
  @IsOptional()
  @IsEnum(BookingStatus)
  bookingStatus?: BookingStatus;

  // Filter by service type
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  // Filter by resource mode
  @IsOptional()
  @IsEnum(ResourceMode)
  resourceMode?: ResourceMode;

  // Filter by category ID
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  // Search by booking number (exact match or partial)
  @IsOptional()
  @IsString()
  bookingNumber?: string;

  // Date range filter for startAt (booking start date)
  @IsOptional()
  @IsDateString()
  startDateFrom?: string; // ISO 8601 format: 2024-12-25T00:00:00.000Z

  @IsOptional()
  @IsDateString()
  startDateTo?: string; // ISO 8601 format: 2024-12-25T23:59:59.999Z

  // Date range filter for submittedAt (submission date)
  @IsOptional()
  @IsDateString()
  submittedDateFrom?: string; // ISO 8601 format: 2024-12-25T00:00:00.000Z

  @IsOptional()
  @IsDateString()
  submittedDateTo?: string; // ISO 8601 format: 2024-12-25T23:59:59.999Z

  // General search (searches in bookingNumber and purpose)
  @IsOptional()
  @IsString()
  search?: string;
}
