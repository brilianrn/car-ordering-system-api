import { FundingSource, ReceiptStatus } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export enum VerificationAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  EDIT = 'EDIT',
}

export class VerifyItemDto {
  @IsInt()
  @IsNotEmpty()
  itemId: number; // ID resi yang diunggah (ReceiptItem ID)

  @IsOptional()
  @IsEnum(FundingSource)
  sourceFund?: FundingSource; // Cash Driver, Mode-B/Pribadi, Vendor, Operasional

  @IsEnum(VerificationAction)
  @IsNotEmpty()
  action: VerificationAction; // Approve, Reject, Edit

  @IsOptional()
  @IsString()
  notes?: string; // Internal notes

  @IsOptional()
  @IsString()
  @MinLength(5, { message: 'Rejection reason must be at least 5 characters' })
  rejectionReason?: string; // Alasan penolakan untuk driver

  @IsOptional()
  @IsEnum(ReceiptStatus)
  status?: ReceiptStatus; // PENDING, APPROVED, REJECTED (Frontend sends this)

  @IsOptional()
  @IsInt()
  amountIdr?: number; // Revisi nominal

  @IsOptional()
  @IsString()
  category?: string; // Revisi kategori

  @IsOptional()
  @IsEnum(FundingSource)
  defaultFundingSource?: FundingSource; // Default fallback if sourceFund is empty

  @IsOptional()
  receiptDate?: Date; // Revisi tanggal
}
