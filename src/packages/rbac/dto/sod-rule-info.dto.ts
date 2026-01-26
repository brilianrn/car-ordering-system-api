import { Role } from '@prisma/client';

export class RoleInfoDto {
  id: string;
  name: Role;
  displayName: string;
}

export class SoDRuleInfoDto {
  id: string;
  name: string;
  description?: string;
  primaryRole: RoleInfoDto;
  conflictingRole: RoleInfoDto;
  isActive: boolean;
}

export class SoDValidationResultDto {
  isValid: boolean;
  violations: SoDRuleInfoDto[];
  errorMessage?: string;
}
