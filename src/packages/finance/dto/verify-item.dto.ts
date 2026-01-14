import { FundingSource } from '@prisma/client';
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

  @IsEnum(FundingSource)
  @IsNotEmpty()
  sourceFund: FundingSource; // Cash Driver, Mode-B/Pribadi, Vendor, Operasional

  @IsEnum(VerificationAction)
  @IsNotEmpty()
  action: VerificationAction; // Approve, Reject, Edit

  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Notes must be at least 10 characters when action is REJECT or EDIT' })
  notes?: string; // Wajib diisi jika status Reject atau Edit (minimal 10 karakter)
}
