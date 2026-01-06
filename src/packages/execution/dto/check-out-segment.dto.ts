import { IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CheckOutSegmentDto {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(0)
  odoEnd: number; // Odometer reading at check-out (km)

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  gpsDistance?: number; // GPS distance (km) - optional
}
