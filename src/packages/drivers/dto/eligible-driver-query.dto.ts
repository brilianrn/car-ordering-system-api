import { DriverType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class EligibleDriverQueryDto {
  @IsOptional()
  @IsString()
  transmission?: string;

  @IsOptional()
  @IsString()
  plantLocation?: string;

  @IsOptional()
  @Type(() => Number)
  vendorId?: number;

  @IsOptional()
  @IsEnum(DriverType)
  driverType?: DriverType;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isDedicated?: boolean;
}
