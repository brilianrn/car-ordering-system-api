import { Transform } from 'class-transformer';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class SearchUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  query?: string; // Search by name, employeeId, or email

  @IsOptional()
  @IsString()
  @MinLength(1)
  employeeId?: string; // Search by employee ID

  @IsOptional()
  @IsString()
  @MinLength(1)
  email?: string; // Search by email

  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string; // Search by full name

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map((v) => v.trim());
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  roles?: string[]; // Filter by user roles (e.g., LEADER, GA, ADMIN)
}
