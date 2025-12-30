import { IsEnum, IsInt, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';

// TODO: Generate Prisma client after schema migration
export enum CarpoolConsentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
}

export class RespondInviteDto {
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(1)
  inviteId: number; // CarpoolInvite ID

  @IsEnum(CarpoolConsentStatus)
  @IsNotEmpty()
  consentStatus: CarpoolConsentStatus; // APPROVED or DECLINED
}
