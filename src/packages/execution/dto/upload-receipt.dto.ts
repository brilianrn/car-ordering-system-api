import { CostCategory } from '@/packages/cost-variable/dto/create-cost-variable.dto';
import { FundingSource } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class UploadReceiptDto {
  @IsEnum(CostCategory)
  @IsNotEmpty()
  category: CostCategory; // FUEL, TOLL, PARKING, DRIVER, VEHICLE_MAINTENANCE, OTHER (from Cost Variable) - Required, should be filled from OCR scan or manual input

  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(1)
  amountIdr: number; // Amount in IDR - Required, should be filled from OCR scan or manual input

  @IsDateString()
  @IsNotEmpty()
  receiptDate: string; // ISO 8601 date string - Required, should be filled from OCR scan or manual input

  @IsString()
  @IsNotEmpty()
  photoUrl: string; // URL of receipt photo (after upload) - S3 key or presigned URL

  @IsEnum(FundingSource)
  @IsNotEmpty()
  fundingSource: FundingSource; // DRIVER_CASH, MODE_B, VENDOR, OPERATIONAL

  @IsOptional()
  @IsString()
  dupHash?: string; // Hash for duplicate detection (optional, auto-generated if not provided)
}
