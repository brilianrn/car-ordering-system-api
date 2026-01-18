import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator';

export class InviteCarpoolDto {
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(1)
  hostBookingId: number;

  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(1)
  joinerBookingId: number;

  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(1)
  expiresInMinutes?: number;

  @IsOptional()
  @IsBoolean()
  gaMerge: boolean;
}
