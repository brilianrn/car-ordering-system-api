import { IsString, IsDateString, MinLength } from 'class-validator';

export class AssignTempRoleDto {
  @IsString()
  employeeId: string;

  @IsString()
  roleId: string;

  @IsString()
  @MinLength(10, { message: 'Reason must be at least 10 characters long' })
  reason: string;

  @IsDateString()
  tempRoleEnd: string; // ISO date string
}
