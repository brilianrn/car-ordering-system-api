import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PublishParamSetDto {
  @IsString()
  @IsNotEmpty()
  publishedBy: string; // User ID yang melakukan publish (harus berbeda dengan createdBy)

  @IsString()
  @IsOptional()
  notes?: string; // Alasan publish
}
