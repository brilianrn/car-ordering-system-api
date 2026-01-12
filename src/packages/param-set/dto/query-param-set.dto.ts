import { ParamEnvironment, ParamSetStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class QueryParamSetDto {
  @IsEnum(ParamSetStatus)
  @IsOptional()
  status?: ParamSetStatus;

  @IsEnum(ParamEnvironment)
  @IsOptional()
  environment?: ParamEnvironment;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;
}
