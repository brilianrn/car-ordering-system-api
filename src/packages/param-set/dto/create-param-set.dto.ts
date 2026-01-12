import { ParamEnvironment, ParamGroup, ParamName, ParamScope } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

export class CreateParamItemDto {
  @IsEnum(ParamName)
  @IsNotEmpty()
  name: ParamName;

  @IsEnum(ParamGroup)
  @IsNotEmpty()
  group: ParamGroup;

  @IsString()
  @IsNotEmpty()
  value: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsEnum(ParamScope)
  @IsOptional()
  scope?: ParamScope = ParamScope.GLOBAL;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateParamSetDto {
  @IsEnum(ParamEnvironment)
  @IsOptional()
  environment?: ParamEnvironment = ParamEnvironment.UAT;

  @Type(() => Date)
  @IsNotEmpty()
  effectiveFrom: Date; // Wajib, >= Now (validated in usecase)

  @Type(() => Date)
  @IsOptional()
  effectiveTo?: Date; // Opsional

  @IsString()
  @IsOptional()
  notes?: string; // Alasan perubahan

  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateParamItemDto)
  items: CreateParamItemDto[];
}
