import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

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

  @IsString()
  @IsNotEmpty()
  odometerImageUrl: string;
}
