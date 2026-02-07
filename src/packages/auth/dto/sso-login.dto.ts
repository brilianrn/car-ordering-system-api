import { IsNotEmpty, IsString } from 'class-validator';

export class SsoLoginDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
