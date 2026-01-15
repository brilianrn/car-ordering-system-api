import { IsDateString, IsOptional, IsString } from 'class-validator';

export class QueryAnalyticsDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  plant?: string;

  @IsOptional()
  @IsString()
  orgUnitCode?: string;

  @IsOptional()
  @IsString()
  category?: string;
}

export {};
