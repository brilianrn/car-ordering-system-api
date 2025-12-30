import { IsInt, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UnmergeCarpoolDto {
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(1)
  carpoolGroupId: number; // CarpoolGroup ID to unmerge
}
