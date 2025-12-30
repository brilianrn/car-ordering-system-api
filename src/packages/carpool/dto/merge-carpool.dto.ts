import { IsEnum, IsInt, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum CostMode {
  EQUAL = 'EQUAL', // Per Pax Equal
  PROPORTIONAL_DISTANCE = 'PROPORTIONAL_DISTANCE', // Proporsional Jarak
}

export class MergeCarpoolDto {
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(1)
  carpoolGroupId: number; // CarpoolGroup ID to merge

  @IsEnum(CostMode)
  @IsNotEmpty()
  costMode: CostMode; // EQUAL or PROPORTIONAL_DISTANCE
}
