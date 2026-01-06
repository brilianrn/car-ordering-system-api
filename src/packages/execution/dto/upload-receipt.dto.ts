import { FundingSource } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UploadReceiptDto {
  @IsString()
  @IsNotEmpty()
  category: string; // e.g., "fuel", "toll", "parking", "other"

  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(1)
  amountIdr: number; // Amount in IDR

  @IsDateString()
  @IsNotEmpty()
  receiptDate: string; // ISO 8601 date string

  @IsString()
  @IsNotEmpty()
  photoUrl: string; // URL of receipt photo (after upload)

  @IsEnum(FundingSource)
  @IsNotEmpty()
  fundingSource: FundingSource; // DRIVER_CASH, MODE_B, VENDOR, OPERATIONAL

  @IsOptional()
  @IsString()
  dupHash?: string; // Hash for duplicate detection (optional, auto-generated if not provided)
}
