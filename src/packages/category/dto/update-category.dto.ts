import { CategoryScope, CategoryStatus } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Length, Max, Min, Matches } from 'class-validator';

export class UpdateCategoryDto {
  @IsString()
  @IsOptional()
  @Length(3)
  name?: string; // minimal 3 karakter, unik case-insensitive

  @IsEnum(CategoryStatus)
  @IsOptional()
  status?: CategoryStatus; // ACTIVE atau INACTIVE

  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(999)
  displayOrder?: number; // 0-999

  @IsEnum(CategoryScope)
  @IsOptional()
  scope?: CategoryScope; // GLOBAL, PLANT, atau DIVISI
}
