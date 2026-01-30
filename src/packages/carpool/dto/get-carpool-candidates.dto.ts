import { IsOptional, IsString } from 'class-validator';

export class GetCarpoolCandidatesDto {
  @IsOptional()
  @IsString()
  start_date?: string; // ISO 8601 date string

  @IsOptional()
  @IsString()
  end_date?: string; // ISO 8601 date string
}
