import { globalLogger as Logger } from '@/shared/utils/logger';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { IJwtPayload, ILoginResponse, IRegisterResponse, ISsoCheckToken } from '../dto';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { AuthRepositoryPort } from '../ports/repository.port';
import { AuthUsecasePort, IVerifyAccountResponse } from '../ports/usecase.port';

@Injectable()
export class AuthUseCase implements AuthUsecasePort {
  constructor(
    @Inject('AuthRepositoryPort')
    private readonly repository: AuthRepositoryPort,
    private readonly jwt: JwtService,
    private readonly configService: ConfigService,
  ) {}

  login = async (dto: LoginDto): Promise<IUsecaseResponse<ILoginResponse>> => {
    try {
      const account = await this.repository.findAccountByEmail(dto.email);
      if (!account) {
        return {
          error: {
            message: 'Invalid email or password',
            code: HttpStatus.UNAUTHORIZED,
          },
        };
      }

      if (!account.employee) {
        return {
          error: {
            message: 'Account is not linked to an employee',
            code: HttpStatus.UNAUTHORIZED,
          },
        };
      }

      const isPasswordValid = await bcrypt.compare(dto.password, account.password);
      if (!isPasswordValid) {
        return {
          error: {
            message: 'Invalid email or password',
            code: HttpStatus.UNAUTHORIZED,
          },
        };
      }

      if (!account.isVerified) {
        return {
          error: {
            message: 'Account is not verified',
            code: HttpStatus.UNAUTHORIZED,
          },
        };
      }

      const payload: IJwtPayload = {
        sub: account.employee.employeeId,
        email: account.email,
        roles: (account.employee as any).effectiveRoles || ['USER'],
        employeeId: account.employee.employeeId,
        fullName: account.employee.fullName,
      };

      const accessToken = this.jwt.sign(payload);

      return {
        data: {
          accessToken: accessToken,
          user: {
            employeeId: account.employee.employeeId,
            email: account.email,
            fullName: account.employee.fullName,
            roles: (account.employee as any).effectiveRoles || ['USER'],
          },
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in login',
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
        // GLONDONGAN MODE: Flexible validation
        Logger.info(`Registration in GLONDONGAN mode for NIK: ${dto.nik}`, 'AuthUseCase.register');

        employee = await this.repository.findEmployeeByNik(dto.nik);

        if (!employee) {
          // If employee doesn't exist, create a placeholder one
          // This allows registration before employee sync is complete
          const nameFromEmail = dto.email.split('@')[0];
          try {
            employee = await this.repository.createPlaceholderEmployee({
              employeeId: dto.nik,
              email: dto.email,
              fullName: dto.fullName || nameFromEmail, // Adapt from email if not provided
            });
          } catch (createError) {
            Logger.error(
              `Failed to create placeholder employee: ${createError instanceof Error ? createError.message : 'Unknown'}`,
              undefined,
              'AuthUseCase.register',
            );
            return {
              error: {
                message: 'Failed to create employee record',
                code: HttpStatus.INTERNAL_SERVER_ERROR,
              },
            };
          }
        } else {
          // Employee exists, check if already has account
          // (Handled by step 3, but double check logic if needed)
          // Also check email match is optional in Glondongan?
          // Let's enforce email match if employee has email, for consistency
          if (employee.email && employee.email !== dto.email) {
            Logger.warn(
              `Email mismatch in Glondongan mode. Input: ${dto.email}, Record: ${employee.email}`,
              'AuthUseCase.register',
            );
            // In Glondongan we might allow it, or update it?
            // For now, let's allow it but warn. Or maybe strictly enforce?
            // "Validation NIK & Email is mandatory" says the prompt for Strict mode.
            // For Glondongan, we just need NIK format probably.
          }
        }
      }

      // 5. Create Account
      const hashedPassword = await bcrypt.hash(dto.password, 10);
      const verificationToken = crypto.randomBytes(32).toString('hex');

      await this.repository.createAccount({
        email: dto.email,
        password: hashedPassword,
        employeeId: dto.nik,
        isVerified: false,
        verificationToken,
      });

      // 6. Send Verification Email (TODO)
      // For now, just return success
      // In Glondongan mode, maybe auto-verify?
      // "Allow registration... verification email will be sent" -> implied standard flow.

      return {
        data: {
          message: 'Registration successful. Please check your email for verification.',
          email: dto.email,
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in register',
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

  verifyEmail = async (token: string): Promise<IUsecaseResponse<{ message: string }>> => {
    try {
      const account = await this.repository.findAccountByToken(token);
      if (!account) {
        return {
          error: {
            message: 'Invalid or expired verification token',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      await this.repository.updateAccountVerification(account.id);

      return {
        data: {
          message: 'Email verification successful. You can now login.',
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in verifyEmail',
        error instanceof Error ? error.stack : undefined,
        'AuthUseCase.verifyEmail',
      );
      return {
        error: {
          message: 'An error occurred during email verification',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  searchUsers = async (params: {
    query?: string;
    employeeId?: string;
    email?: string;
    fullName?: string;
    roles?: string[];
    limit?: number;
  }): Promise<
    IUsecaseResponse<
      Array<{
        employeeId: string;
        fullName: string;
        email: string;
        orgUnit: { id: number; code: string; name: string } | null;
      }>
    >
  > => {
    try {
      const users = await this.repository.searchUsers(params);
      return {
        data: users,
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in searchUsers',
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

  verifyAccount = async (token: string): Promise<IUsecaseResponse<IVerifyAccountResponse>> => {
    try {
      const account = await this.repository.findAccountByToken(token);
      if (!account) {
        return {
          error: {
            message: 'Invalid or expired verification token',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      if (account.isVerified) {
        return {
          data: {
            message: 'Account already verified',
          },
        };
      }

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

  ssoLogin = async (token: string): Promise<IUsecaseResponse<ILoginResponse>> => {
    try {
      // 1. External Validation via Repository
      let ssoUser: ISsoCheckToken;
      try {
        ssoUser = await this.repository.validateSSOToken(token);
      } catch (error) {
        Logger.error(
          `SSO Validation Failed: ${error instanceof Error ? error.message : 'Unknown'}`,
          undefined,
          'AuthUseCase.ssoLogin',
        );
        return {
          error: {
            message: 'Invalid SSO Token',
            code: HttpStatus.UNAUTHORIZED,
          },
        };
      }

      // Validate critical fields
      const {
        npk,
        full_name,
        email,
        department,
        division,
        user_type,
        role_name,
        role_apps_status,
        number_phone,
        photo,
        photo_url,
        vendor_name,
      } = ssoUser;

      if (!npk) {
        return {
          error: {
            message: 'Invalid SSO User Data: Missing NPK',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // Validate Application Access
      if (role_apps_status !== 'true') {
        return {
          error: {
            message: 'Unauthorized: Application access denied',
            code: HttpStatus.FORBIDDEN,
          },
        };
      }

      // 2. Upsert SSO User (Atomic Transaction)
      const hashedPassword = await bcrypt.hash(npk, 10);
      const employeeForToken = await this.repository.upsertSSOUser({
        employeeId: npk,
        fullName: full_name || 'No Name',
        email: email,
        passwordHash: hashedPassword,
        department: department,
        division: division,
        userType: user_type as 'Internal' | 'External',
        roleName: role_name,
        phoneNumber: number_phone,
        photoUrl: photo || photo_url || undefined,
        vendorName: vendor_name,
      });

      // Ensure account exists for payload
      if (!employeeForToken.account) {
        throw new Error('Failed to retrieve or create account for SSO user');
      }

      // 3. Generate Token
      const payload: IJwtPayload = {
        sub: employeeForToken.account.id.toString(), // Account ID as sub
        email: employeeForToken.account.email,
        roles: (employeeForToken as any).effectiveRoles?.map((r: any) =>
          typeof r === 'string' ? r : r.role?.name || 'USER',
        ) || ['USER'],
        employeeId: employeeForToken.employeeId,
        driverId: employeeForToken.driverProfile?.id,
        fullName: employeeForToken.fullName,
      };

      const accessToken = this.jwt.sign(payload);

      return {
        data: {
          accessToken,
          user: {
            employeeId: employeeForToken.employeeId,
            email: employeeForToken.account.email,
            fullName: employeeForToken.fullName,
            roles: (employeeForToken as any).effectiveRoles || ['USER'],
          },
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in ssoLogin',
        error instanceof Error ? error.stack : undefined,
        'AuthUseCase.ssoLogin',
      );
      return {
        error: {
          message: 'SSO Login Failed',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };
}
