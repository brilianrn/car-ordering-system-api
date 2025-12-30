import { IsInt, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class InviteCarpoolDto {
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(1)
  hostBookingId: number; // Host booking ID

  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(1)
  joinerBookingId: number; // Joiner booking ID to invite

  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  @Min(1)
  expiresInMinutes?: number; // Optional: invitation expiry in minutes (default from config)
}
