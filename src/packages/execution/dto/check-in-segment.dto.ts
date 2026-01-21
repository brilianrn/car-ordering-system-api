import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class CheckInSegmentDto {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(0)
  odoStart: number; // Odometer reading at check-in (km)
}
