import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class EstimateCostDto {
  @IsDateString()
  @IsNotEmpty()
  tripDate: string; // ISO 8601 date string - tanggal perjalanan untuk snapshot logic

  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(0)
  distanceKm: number; // Jarak dalam kilometer

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  durationHours?: number; // Durasi dalam jam (untuk parking hourly)

  @IsString()
  @IsOptional()
  vehicleType?: string; // Vehicle type untuk fallback KM/L

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  fuelConsumption?: number; // KM/L dari master kendaraan (jika ada)

  @IsString()
  @IsOptional()
  scope?: string; // Scope untuk filtering (GLOBAL, PLANT, DIVISI)
}
