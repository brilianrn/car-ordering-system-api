import { CategoryScope, CategoryStatus } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Length, Max, Min, Matches } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsOptional()
  @Length(2, 12)
  @Matches(/^[A-Z0-9_]+$/, { message: 'code must be uppercase alphanumeric with underscores, no spaces' })
  code?: string; // Optional: 2-12 karakter, UPPERCASE, tanpa spasi, unik. Jika tidak disediakan, akan auto-generated oleh API

  @IsString()
  @IsNotEmpty()
  @Length(3)
  name: string; // minimal 3 karakter, unik case-insensitive

  @IsEnum(CategoryStatus)
  @IsOptional()
  status?: CategoryStatus = CategoryStatus.ACTIVE; // Default: ACTIVE

  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(999)
  displayOrder?: number = 0; // 0-999, default: 0

  @IsEnum(CategoryScope)
  @IsOptional()
  scope?: CategoryScope = CategoryScope.GLOBAL; // Default: GLOBAL
}
