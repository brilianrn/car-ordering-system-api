import { authRoute, ERoutes } from '@/shared/constants/routes';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { response } from '@/shared/utils/rest-api/response';
import { Body, Controller, Get, HttpStatus, Inject, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { SearchUserDto } from '../dto/search-user.dto';
import { AuthUsecasePort } from '../ports/usecase.port';

@Controller(ERoutes.AUTH)
export class AuthController {
  constructor(
    @Inject('AuthUsecasePort')
    private readonly usecase: AuthUsecasePort,
  ) {
    this.usecase = usecase;
  }

  @Post(authRoute.login)
  async login(@Body() dto: LoginDto, @Res() res: Response) {
    try {
      const result = await this.usecase.login(dto);

      if (result?.error) {
        const statusCode = result.error.code || HttpStatus.BAD_REQUEST;
        return response[statusCode](res, {
          message: result.error.message,
        });
      }

      return response[HttpStatus.OK](res, {
        message: 'Login successful',
        data: result.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error in login controller',
        error instanceof Error ? error.stack : undefined,
        'AuthController.login',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: 'An error occurred during login',
      });
    }
  }

  @Post(authRoute.register)
  async register(@Body() dto: RegisterDto, @Res() res: Response) {
    try {
      const result = await this.usecase.register(dto);

      if (result?.error) {
        const statusCode = result.error.code || HttpStatus.BAD_REQUEST;
        return response[statusCode](res, {
          message: result.error.message,
        });
      }

      return response[HttpStatus.CREATED](res, {
        message: result.data?.message || 'Registration successful',
        data: { email: result.data?.email },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error in register controller',
        error instanceof Error ? error.stack : undefined,
        'AuthController.register',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: 'An error occurred during registration',
      });
    }
  }

  @Get(authRoute.searchUser)
  async searchUser(@Query() dto: SearchUserDto, @Res() res: Response) {
    try {
      const result = await this.usecase.searchUsers(dto);

      if (result?.error) {
        const statusCode = result.error.code || HttpStatus.BAD_REQUEST;
        return response[statusCode](res, {
          message: result.error.message,
        });
      }

      return response[HttpStatus.OK](res, {
        message: 'Search users successful',
        data: result.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error in searchUser controller',
        error instanceof Error ? error.stack : undefined,
        'AuthController.searchUser',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: 'An error occurred while searching users',
      });
    }
  }
}
