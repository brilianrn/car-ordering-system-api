import { DriverType, TransmissionType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListDriverQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(DriverType)
  type?: DriverType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  vendor?: number;

  @IsOptional()
  @IsString()
  plant?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dedicated?: boolean;

  @IsOptional()
  @IsEnum(TransmissionType)
  transmission?: TransmissionType;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activeOnly?: boolean = true;
}
