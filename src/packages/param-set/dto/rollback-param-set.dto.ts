import { IsOptional, IsString } from 'class-validator';

export class RollbackParamSetDto {
  @IsString()
  @IsOptional()
  notes?: string; // Alasan rollback
}
