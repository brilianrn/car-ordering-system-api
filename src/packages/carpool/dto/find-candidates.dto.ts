import { IsInt, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FindCandidatesDto {
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(1)
  hostBookingId: number; // The booking that will act as host
}
