import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CheckInSegmentDto {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(0)
  odoStart: number; // Odometer reading at check-in (km)

  @IsString()
  @IsNotEmpty()
  odometerImageUrl: string;
}
