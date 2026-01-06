import { VerifyStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class VerifyExecutionDto {
  @IsEnum(VerifyStatus)
  @IsNotEmpty()
  verifyStatus: VerifyStatus; // VERIFIED or BLOCKED

  @IsOptional()
  @IsString()
  reimburseTicket?: string; // Reimbursement ticket ID (if verified)

  @IsOptional()
  @IsString()
  replenishTicket?: string; // Replenishment ticket ID (if needed)

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  anomalyHandled?: boolean; // Flag if anomaly has been handled

  @IsOptional()
  @IsString()
  note?: string; // Optional verification note
}
