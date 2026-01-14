import { IsOptional, IsString } from 'class-validator';

export class CloseTripDto {
  @IsOptional()
  @IsString()
  note?: string; // Optional note for closing trip
}
