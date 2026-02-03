import { getVerificationEmailTemplate } from '@/shared/templates/mail/verification-email';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { sendMail } from '@/shared/utils/smtp';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { IJwtPayload, ILoginResponse, IRegisterResponse } from '../dto';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { SearchUserDto } from '../dto/search-user.dto';
import { AuthRepositoryPort } from '../ports/repository.port';
import { AuthUsecasePort, ISearchUserResult, IVerifyAccountResponse } from '../ports/usecase.port';

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

      // 2. Validate email domain (ALWAYS REQUIRED for security)
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

      // 4. Read sync status flag to determine validation mode
      const isSyncReady = this.configService.get<string>('SYNC_DATA_EMPLOYEE_READY') === 'true';

      let employee: any;

      if (isSyncReady) {
        // STRICT MODE: Validate NIK exists and email matches
        Logger.info(`Registration in STRICT mode for NIK: ${dto.nik}`, 'AuthUseCase.register');

        employee = await this.repository.findEmployeeByNik(dto.nik);
        if (!employee) {
          return {
            error: {
              message: 'Employee ID (NIK) not found in the system',
              code: HttpStatus.NOT_FOUND,
            },
          };
        }

        // Validate email matches employee email
        if (employee.email !== dto.email) {
          return {
            error: {
              message: 'Email does not match employee record',
              code: HttpStatus.BAD_REQUEST,
            },
          };
        }
      } else {
        Logger.info(`Registration in for NIK: ${dto.nik}`, 'AuthUseCase.register');

        employee = await this.repository.findEmployeeByNik(dto.nik);

        if (!employee) {
          // Extract name from email (before @)
          const emailPrefix = dto.email.split('@')[0];
          const fullName = emailPrefix
            .split('.')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');

          Logger.info(
            `Creating placeholder employee for NIK ${dto.nik} with name: ${fullName}`,
            'AuthUseCase.register',
          );

          // Create placeholder employee
          employee = await this.repository.createPlaceholderEmployee({
            employeeId: dto.nik,
            email: dto.email,
            fullName: fullName || 'User',
          });
        }
      }

      // 5. Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(dto.password, salt);

      // 6. Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');

      // 7. Create account with verification token
      await this.repository.createAccount({
        email: dto.email,
        password: hashedPassword,
        employeeId: employee.employeeId,
        isVerified: false,
        verificationToken,
      });

      // 8. Send verification email
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') || this.configService.get<string>('BASE_URL_WEB');
      const verificationLink = `${frontendUrl}/auth/verify?token=${verificationToken}`;
      const emailHtml = getVerificationEmailTemplate(verificationLink);

      await sendMail({
        to: [dto.email],
        subject: 'Verifikasi Akun COS - Dharma Polimetal',
        html: emailHtml,
      });

      Logger.info(`Account registered successfully for ${dto.email}`, 'AuthUseCase.register');

      return {
        data: {
          message: 'Registration successful. Please check your email to verify your account.',
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

  // =========================================
  // VERIFY ACCOUNT
  // =========================================
  verifyAccount = async (token: string): Promise<IUsecaseResponse<IVerifyAccountResponse>> => {
    try {
      // 1. Find account by token
      const account = await this.repository.findAccountByToken(token);
      if (!account) {
        return {
          error: {
            message: 'Invalid or expired verification token',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 2. Check if already verified
      if (account.isVerified) {
        return {
          data: {
            message: 'Account already verified',
          },
        };
      }

      // 3. Update account verification status
      await this.repository.updateAccountVerification(account.id);

      Logger.info(`Account verified successfully for ${account.email}`, 'AuthUseCase.verifyAccount');

      return {
        data: {
          message: 'Account verified successfully. You can now log in.',
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Unknown error during account verification',
        error instanceof Error ? error.stack : undefined,
        'AuthUseCase.verifyAccount',
      );
      return {
        error: {
          message: 'An error occurred during account verification',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };
}
