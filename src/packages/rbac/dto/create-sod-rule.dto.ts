import { IsString, IsOptional } from 'class-validator';

export class CreateSoDRuleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  primaryRoleId: string;

  @IsString()
  conflictingRoleId: string;
}
