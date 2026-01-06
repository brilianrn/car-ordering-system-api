import { ResourceMode } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignBookingDto {
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(1)
  vehicleChosenId: number; // Vehicle ID to assign

  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(1)
  driverChosenId: number; // Driver ID to assign

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  vendorChosenId?: number; // Vendor ID (required if resourceMode = DAILY_RENT)

  @IsOptional()
  @IsString()
  dispatchNote?: string; // Optional dispatch note

  @IsEnum(ResourceMode)
  @IsNotEmpty()
  resourceMode: ResourceMode; // INTERNAL, DAILY_RENT, or PERSONAL
}
