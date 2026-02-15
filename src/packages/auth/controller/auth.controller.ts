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

  @Get(authRoute.verify)
  async verify(@Query('token') token: string, @Res() res: Response) {
    try {
      if (!token) {
        return response[HttpStatus.BAD_REQUEST](res, {
          message: 'Verification token is required',
        });
      }

      const result = await this.usecase.verifyAccount(token);

      if (result?.error) {
        const statusCode = result.error.code || HttpStatus.BAD_REQUEST;
        return response[statusCode](res, {
          message: result.error.message,
        });
      }

      return response[HttpStatus.OK](res, {
        message: result.data?.message || 'Account verified successfully',
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error in verify controller',
        error instanceof Error ? error.stack : undefined,
        'AuthController.verify',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: 'An error occurred during account verification',
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

  @Post(authRoute.ssoLogin)
  async ssoLogin(@Body() dto: { token: string }, @Res() res: Response) {
    try {
      if (!dto.token) {
        return response[HttpStatus.BAD_REQUEST](res, {
          message: 'SSO token is required',
        });
      }

      const result = await this.usecase.ssoLogin(dto.token);

      if (result?.error) {
        const statusCode = result.error.code || HttpStatus.BAD_REQUEST;
        return response[statusCode](res, {
          message: result.error.message,
        });
      }

      return response[HttpStatus.OK](res, {
        message: 'SSO login successful',
        data: result.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error in ssoLogin controller',
        error instanceof Error ? error.stack : undefined,
        'AuthController.ssoLogin',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: 'An error occurred during SSO login',
      });
    }
  }

  @Post(authRoute.socialLogin)
  async socialLogin(@Body() dto: { token: string }, @Res() res: Response) {
    try {
      if (!dto.token) {
        return response[HttpStatus.BAD_REQUEST](res, {
          message: 'Social token is required',
        });
      }

      // Re-use SSO logic or implement specific social auth logic if different
      // Assuming socialAuth uses the same flow as ssoLogin for now, or usecase.socialAuth if it existed
      // Based on previous analysis, we used ssoLogin for token based auth, let's stick to that or create a wrapper
      // Wait, AuthUseCase didn't have socialAuth, but it has ssoLogin.
      // Let's use ssoLogin as the implementation for now since it takes a token.

      const result = await this.usecase.ssoLogin(dto.token);

      if (result?.error) {
        const statusCode = result.error.code || HttpStatus.BAD_REQUEST;
        return response[statusCode](res, {
          message: result.error.message,
        });
      }

      return response[HttpStatus.OK](res, {
        message: 'Social login successful',
        data: result.data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error in socialLogin controller',
        error instanceof Error ? error.stack : undefined,
        'AuthController.socialLogin',
      );
      return response[HttpStatus.INTERNAL_SERVER_ERROR](res, {
        message: 'An error occurred during social login',
      });
    }
  }
}
