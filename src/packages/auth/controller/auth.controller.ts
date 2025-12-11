// src/modules/auth/controller/auth.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { AuthUseCase } from '../usecase/auth.usecase';

@Controller('auth')
export class AuthController {
  constructor(private readonly authUseCase: AuthUseCase) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authUseCase.login(dto);
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authUseCase.register(dto);
  }
}
