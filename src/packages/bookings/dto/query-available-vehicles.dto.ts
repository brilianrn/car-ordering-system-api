import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryAvailableVehiclesDto {
  @IsDateString()
  @IsOptional()
  startAt?: string; // ISO 8601 format: 2024-12-25T08:00:00.000Z

  @IsDateString()
  @IsOptional()
  endAt?: string; // ISO 8601 format: 2024-12-25T17:00:00.000Z

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orgUnitId?: number; // Filter vehicles available for this organization (dedicated + pool)
}
