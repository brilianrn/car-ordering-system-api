import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  nik: string; // Employee ID

  @IsOptional()
  @IsString()
  @MinLength(3)
  fullName?: string;
}
