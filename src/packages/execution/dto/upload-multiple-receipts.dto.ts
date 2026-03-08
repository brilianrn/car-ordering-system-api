import { CostCategory } from '@/packages/cost-variable/dto/create-cost-variable.dto';
import { FundingSource } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReceiptItemDto {
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

  @IsOptional()
  @IsEnum(FundingSource)
  fundingSource?: FundingSource; // DRIVER_CASH, MODE_B, VENDOR, OPERATIONAL

  @IsOptional()
  @IsString()
  dupHash?: string; // Hash for duplicate detection (optional, auto-generated if not provided)
}

export class UploadMultipleReceiptsDto {
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReceiptItemDto)
  receipts: ReceiptItemDto[];
}
