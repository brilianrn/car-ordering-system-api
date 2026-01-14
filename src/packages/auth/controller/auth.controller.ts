// src/modules/auth/controller/auth.controller.ts
import { ERoutes, authRoute } from '@/shared/constants/routes';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { SearchUserDto } from '../dto/search-user.dto';
import { AuthUseCase } from '../usecase/auth.usecase';

@Controller(ERoutes.AUTH)
export class AuthController {
  constructor(private readonly authUseCase: AuthUseCase) {}

  @Post(authRoute.login)
  async login(@Body() dto: LoginDto) {
    return this.authUseCase.login(dto);
  }

  @Post(authRoute.register)
  async register(@Body() dto: RegisterDto) {
    return this.authUseCase.register(dto);
  }

  @Get(authRoute.searchUser)
  async searchUser(@Query() dto: SearchUserDto) {
    return this.authUseCase.searchUsers(dto);
  }
}
