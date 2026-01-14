import { IsOptional, IsString, MinLength } from 'class-validator';

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
}
