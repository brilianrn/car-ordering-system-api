import { IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CheckInSegmentDto {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(0)
  odoStart: number; // Odometer reading at check-in (km)
}
