import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ExecuteActionDto {
  @IsNotEmpty()
  @IsString()
  token: string;

  @IsOptional()
  @IsString()
  note?: string; // Required for REJECT action
}
