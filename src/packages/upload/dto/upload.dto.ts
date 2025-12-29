import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

export class FileUploadDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  base64: string;
}

export class UploadDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileUploadDto)
  files: FileUploadDto[];

  @IsOptional()
  @IsString()
  path?: string; // Optional path for folder organization (e.g., 'vehicles', 'drivers', 'fuel-receipts')
}
