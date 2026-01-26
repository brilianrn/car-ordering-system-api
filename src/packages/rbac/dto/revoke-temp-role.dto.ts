import { IsString, IsOptional, MinLength } from 'class-validator';

export class RevokeTempRoleDto {
  @IsString()
  tempRoleId: string;

  @IsString()
  @IsOptional()
  @MinLength(5, { message: 'Revoke reason must be at least 5 characters long' })
  revokeReason?: string;
}
