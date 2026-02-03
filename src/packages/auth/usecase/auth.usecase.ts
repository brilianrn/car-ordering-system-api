import { globalLogger as Logger } from '@/shared/utils/logger';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { IJwtPayload, ILoginResponse, IRegisterResponse } from '../dto';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { SearchUserDto } from '../dto/search-user.dto';
import { AuthRepositoryPort } from '../ports/repository.port';
import { AuthUsecasePort, ISearchUserResult } from '../ports/usecase.port';

@Injectable()
export class AuthUseCase implements AuthUsecasePort {
  constructor(
    @Inject('AuthRepositoryPort')
    private readonly repository: AuthRepositoryPort,
    private readonly jwt: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.repository = repository;
  }

  // =========================================
  // REGISTER
  // =========================================
  register = async (dto: RegisterDto): Promise<IUsecaseResponse<IRegisterResponse>> => {
    try {
      // 1. Get allowed email domain from config
      const allowedDomain = this.configService.get<string>('ALLOWED_EMAIL_DOMAIN');
      if (!allowedDomain) {
        Logger.error('ALLOWED_EMAIL_DOMAIN is not configured', undefined, 'AuthUseCase.register');
        return {
          error: {
            message: 'System configuration error',
            code: HttpStatus.INTERNAL_SERVER_ERROR,
          },
        };
      }

      // 2. Validate email domain
      const emailDomain = dto.email.split('@')[1];
      if (emailDomain !== allowedDomain) {
        return {
          error: {
            message: `Email must be from domain: @${allowedDomain}`,
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 3. Check if account already exists
      const existingAccount = await this.repository.findAccountByEmail(dto.email);
      if (existingAccount) {
        return {
          error: {
            message: 'Email already registered',
            code: HttpStatus.CONFLICT,
          },
        };
      }

      // 4. Validate NIK exists in Employee table
      const employee = await this.repository.findEmployeeByNik(dto.nik);
      if (!employee) {
        return {
          error: {
            message: 'Employee ID (NIK) not found in the system',
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // 5. Validate email matches employee email
      if (employee.email !== dto.email) {
        return {
          error: {
            message: 'Email does not match employee record',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 6. Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(dto.password, salt);

      // 7. Create account (isVerified: false by default)
      await this.repository.createAccount({
        email: dto.email,
        password: hashedPassword,
        employeeId: employee.employeeId,
        isVerified: false,
      });

      Logger.info(`Account registered successfully for ${dto.email}`, 'AuthUseCase.register');

      return {
        data: {
          message: 'Registration successful. Please verify your email to activate your account.',
          email: dto.email,
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error during registration',
        error instanceof Error ? error.stack : undefined,
        'AuthUseCase.register',
      );
      return {
        error: {
          message: 'An error occurred during registration',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  // =========================================
  // LOGIN
  // =========================================
  login = async (dto: LoginDto): Promise<IUsecaseResponse<ILoginResponse>> => {
    try {
      // 1. Find account by email
      const account = await this.repository.findAccountByEmail(dto.email);
      if (!account) {
        return {
          error: {
            message: 'Invalid email or password',
            code: HttpStatus.UNAUTHORIZED,
          },
        };
      }

      // 2. Verify password
      const isPasswordValid = await bcrypt.compare(dto.password, account.password);
      if (!isPasswordValid) {
        return {
          error: {
            message: 'Invalid email or password',
            code: HttpStatus.UNAUTHORIZED,
          },
        };
      }

      // 3. Check if account is verified
      if (!account.isVerified) {
        return {
          error: {
            message: 'Account not verified. Please verify your email first.',
            code: HttpStatus.UNAUTHORIZED,
          },
        };
      }

      // 4. Check if employee is active
      const employee = account.employee;
      if (!employee.isActive) {
        return {
          error: {
            message: 'Employee account is inactive',
            code: HttpStatus.UNAUTHORIZED,
          },
        };
      }

      // 5. Generate JWT with proper payload
      const payload: IJwtPayload = {
        sub: employee.employeeId,
        email: employee.email ?? account.email, // fallback to account email if employee email is null
        roles: employee.effectiveRoles ?? [],
        employeeId: employee.employeeId,
      };

      const accessToken = await this.jwt.signAsync(payload);

      Logger.info(`User logged in successfully: ${employee.employeeId}`, 'AuthUseCase.login');

      return {
        data: {
          accessToken,
          user: {
            employeeId: employee.employeeId,
            email: employee.email ?? account.email,
            fullName: employee.fullName,
            roles: employee.effectiveRoles ?? [],
          },
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error during login',
        error instanceof Error ? error.stack : undefined,
        'AuthUseCase.login',
      );
      return {
        error: {
          message: 'An error occurred during login',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  // =========================================
  // SEARCH USER
  // =========================================
  searchUsers = async (dto: SearchUserDto): Promise<IUsecaseResponse<ISearchUserResult[]>> => {
    try {
      const users = await this.repository.searchUsers({
        query: dto.query,
        employeeId: dto.employeeId,
        email: dto.email,
        fullName: dto.fullName,
        limit: 50,
      });

      return {
        data: users,
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error during user search',
        error instanceof Error ? error.stack : undefined,
        'AuthUseCase.searchUsers',
      );
      return {
        error: {
          message: 'An error occurred while searching users',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };
}
