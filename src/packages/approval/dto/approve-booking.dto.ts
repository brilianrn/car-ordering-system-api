import { ApprovalStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ApproveBookingDto {
  @IsEnum(ApprovalStatus)
  @IsNotEmpty()
  decision: ApprovalStatus; // APPROVED, REJECTED, or RETURNED

  @IsOptional()
  @IsString()
  comment?: string; // Optional comment from approver
}
