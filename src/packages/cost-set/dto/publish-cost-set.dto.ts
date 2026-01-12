import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PublishCostSetDto {
  @IsString()
  @IsNotEmpty()
  reviewerId: string; // Reviewer ID untuk Two-Person Rule (harus berbeda dari createdBy)

  @IsString()
  @IsOptional()
  notes?: string; // Alasan publish
}
