import { IsString, IsOptional, IsObject } from 'class-validator';

export class CalculateRolesDto {
  @IsString()
  employeeId: string;

  @IsOptional()
  @IsObject()
  hrisAttributes?: {
    organizationUnit?: string;
    division?: string;
    department?: string;
    costCenter?: string;
    position?: string;
    jobFamily?: string;
    immediateSupervisor?: string;
    immediateManager?: string;
  };
}
