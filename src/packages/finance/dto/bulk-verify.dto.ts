import { FundingSource } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class BulkVerifyDto {
  @IsInt()
  @IsNotEmpty()
  verificationHeaderId: number; // ID VerificationHeader yang akan di-bulk approve

  @IsOptional()
  @IsString()
  reimburseTicket?: string; // Optional: nomor tiket reimburse

  @IsOptional()
  @IsString()
  replenishTicket?: string; // Optional: nomor tiket replenish

  @IsOptional()
  @IsEnum(FundingSource)
  defaultFundingSource?: FundingSource; // Dikirim frontend tapi opsional di pakai backend
}
