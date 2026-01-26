import { IsString, IsOptional, IsArray, IsDateString, ValidateNested, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class RoleMatrixMappingDto {
  @IsString()
  roleId: string;

  @IsOptional()
  @IsString()
  orgUnitCode?: string;

  @IsOptional()
  @IsString()
  orgUnitPattern?: string;

  @IsOptional()
  @IsString()
  division?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  costCenter?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  positionPattern?: string;

  @IsOptional()
  @IsString()
  jobFamily?: string;

  @IsOptional()
  @IsString()
  jobFamilyPattern?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  priority: number = 0;
}

export class CreateRoleMatrixDto {
  @IsString()
  version: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoleMatrixMappingDto)
  mappings: RoleMatrixMappingDto[];

  @IsDateString()
  effectiveFrom: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
