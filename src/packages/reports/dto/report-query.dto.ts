import { Transform, Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export enum TripMode {
  A = 'A',
  B = 'B',
  OPERATIONAL = 'OPERATIONAL',
}

export enum ExportFormat {
  XLS = 'xls',
  PDF = 'pdf',
}

export class ReportQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  plants?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  orgUnitCodes?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(TripMode, { each: true })
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  tripModes?: TripMode[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  categories?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string = 'Asia/Jakarta';
}

export class ExportReportDto extends ReportQueryDto {
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  filename?: string;
}

export class RecapQueryDto extends ReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  drillDownLevel?: 'booking' | 'segment' | 'execution' | 'receipt';
}
