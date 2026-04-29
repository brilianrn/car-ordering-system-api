import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Account, Driver, Employee, PrismaClient, Role } from '@prisma/client';
import axios from 'axios';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { ISsoCheckToken } from '../dto';
import { AuthRepositoryPort } from '../ports/repository.port';

@Injectable()
export class AuthRepository implements AuthRepositoryPort {
  constructor(private readonly configService: ConfigService) {}

  private readonly db: PrismaClient = clientDb;

  /**
   * Find employee by email
   */
  async findEmployeeByEmail(email: string): Promise<(Employee & { orgUnit: any }) | null> {
    try {
      return await this.db.employee.findUnique({
        where: { email },
        include: {
          orgUnit: true,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error finding employee by email',
        error instanceof Error ? error.stack : undefined,
        'AuthRepository.findEmployeeByEmail',
      );
      return null;
    }
  }

  /**
   * Find employee by NIK (Employee ID)
   */
  async findEmployeeByNik(
    nik: string,
  ): Promise<(Employee & { orgUnit: any; account: Account | null; driverProfile: Driver | null }) | null> {
    try {
      return await this.db.employee.findUnique({
        where: { employeeId: nik },
        include: {
          orgUnit: true,
          account: true,
          driverProfile: true,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error finding employee by NIK',
        error instanceof Error ? error.stack : undefined,
        'AuthRepository.findEmployeeByNik',
      );
      return null;
    }
  }

  /**
   * Find account by email
   */
  async findAccountByEmail(email: string): Promise<(Account & { employee: Employee & { orgUnit: any } }) | null> {
    try {
      const res = await this.db.account.findUnique({
        where: { email },
        include: {
          employee: {
            include: {
              orgUnit: true,
            },
          },
        },
      });
      return res;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error finding account by email',
        error instanceof Error ? error.stack : undefined,
        'AuthRepository.findAccountByEmail',
      );
      return null;
    }
  }

  /**
   * Find account by email or NIK (employeeId)
   */
  async findAccountByIdentifier(
    identifier: string,
  ): Promise<(Account & { employee: Employee & { orgUnit: any } }) | null> {
    try {
      // Because employeeId is NOT the primary key of Account globally, we findFirst with OR
      const res = await this.db.account.findFirst({
        where: {
          OR: [{ email: identifier }, { employeeId: identifier }],
        },
        include: {
          employee: {
            include: {
              orgUnit: true,
            },
          },
        },
      });
      return res;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error finding account by identifier',
        error instanceof Error ? error.stack : undefined,
        'AuthRepository.findAccountByIdentifier',
      );
      return null;
    }
  }

  /**
   * Create new account
   */
  async createAccount(data: {
    email: string;
    password: string;
    employeeId: string;
    isVerified?: boolean;
    verificationToken?: string;
  }): Promise<Account> {
    try {
      return await this.db.account.create({
        data: {
          email: data.email,
          password: data.password,
          employeeId: data.employeeId,
          isVerified: data.isVerified ?? false,
          verificationToken: data.verificationToken,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error creating account',
        error instanceof Error ? error.stack : undefined,
        'AuthRepository.createAccount',
      );
      throw error;
    }
  }

  /**
   * Find account by verification token
   */
  async findAccountByToken(token: string): Promise<Account | null> {
    try {
      return await this.db.account.findFirst({
        where: { verificationToken: token },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error finding account by token',
        error instanceof Error ? error.stack : undefined,
        'AuthRepository.findAccountByToken',
      );
      return null;
    }
  }

  /**
   * Update account verification (set isVerified = true, remove token)
   */
  async updateAccountVerification(id: number): Promise<Account> {
    try {
      return await this.db.account.update({
        where: { id },
        data: {
          isVerified: true,
          verificationToken: null,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error updating account verification',
        error instanceof Error ? error.stack : undefined,
        'AuthRepository.updateAccountVerification',
      );
      throw error;
    }
  }

  /**
   * Create placeholder employee for glondongan mode
   */
  async createPlaceholderEmployee(data: { employeeId: string; email: string; fullName: string }): Promise<Employee> {
    try {
      // Dynamically find a valid org unit to avoid foreign key constraint errors
      let orgUnitId = 1;
      const defaultOrgUnit = await this.db.organizationUnit.findFirst({
        where: { deletedAt: null },
        select: { id: true },
      });

      if (defaultOrgUnit) {
        orgUnitId = defaultOrgUnit.id;
      }

      return await this.db.employee.create({
        data: {
          employeeId: data.employeeId,
          fullName: data.fullName,
          email: data.email,
          orgUnitId: orgUnitId,
          effectiveRoles: ['USER'],
          effectiveFrom: new Date(), // Set effective date to now
          isActive: true,
          createdBy: 'SYSTEM',
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error creating placeholder employee',
        error instanceof Error ? error.stack : undefined,
        'AuthRepository.createPlaceholderEmployee',
      );
      throw error;
    }
  }

  /**
   * Search users (for autocomplete/search functionality)
   */
  async searchUsers(params: {
    query?: string;
    employeeId?: string;
    email?: string;
    fullName?: string;
    roles?: string[];
    limit?: number;
  }): Promise<
    Array<{
      employeeId: string;
      fullName: string;
      email: string;
      orgUnit: {
        id: number;
        code: string;
        name: string;
      } | null;
    }>
  > {
    try {
      const { query, employeeId, email, fullName, roles, limit = 50 } = params;

      const where: any = {
        deletedAt: null,
        isActive: true,
      };

      if (query) {
        where.OR = [
          { employeeId: { contains: query, mode: 'insensitive' } },
          { fullName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ];
      } else {
        if (employeeId) {
          where.employeeId = { contains: employeeId, mode: 'insensitive' };
        }
        if (email) {
          where.email = { contains: email, mode: 'insensitive' };
        }
        if (fullName) {
          where.fullName = { contains: fullName, mode: 'insensitive' };
        }
      }

      // Add roles filter if provided
      if (params.roles && params.roles.length > 0) {
        where.effectiveRoles = {
          hasSome: params.roles as Role[],
        };
      }

      return (await this.db.employee.findMany({
        where,
        select: {
          employeeId: true,
          fullName: true,
          email: true,
          orgUnit: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        take: limit,
        orderBy: {
          fullName: 'asc',
        },
      })) as Array<{
        employeeId: string;
        fullName: string;
        email: string;
        orgUnit: {
          id: number;
          code: string;
          name: string;
        } | null;
      }>;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error searching users',
        error instanceof Error ? error.stack : undefined,
        'AuthRepository.searchUsers',
      );
      throw error;
    }
  }

  /**
   * Create SSO account (no password, auto-verified)
   */
  async createSsoAccount(data: { email: string; employeeId: string }): Promise<Account> {
    try {
      // Generate a random password hash (never used, but required by schema)
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      return await this.db.account.create({
        data: {
          email: data.email,
          password: hashedPassword,
          employeeId: data.employeeId,
          isVerified: true, // SSO users are auto-verified
          verificationToken: null,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error creating SSO account',
        error instanceof Error ? error.stack : undefined,
        'AuthRepository.createSsoAccount',
      );
      throw error;
    }
  }

  /**
   * Find Organization Unit by Name (e.g. Department)
   */
  async findOrgUnitByName(name: string): Promise<{ id: number; code: string } | null> {
    try {
      return await this.db.organizationUnit.findFirst({
        where: {
          name: {
            contains: name,
            mode: 'insensitive',
          },
          deletedAt: null,
        },
        select: { id: true, code: true },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error finding org unit by name',
        error instanceof Error ? error.stack : undefined,
        'AuthRepository.findOrgUnitByName',
      );
      return null;
    }
  }

  /**
   * Create Employee with full details
   */
  async createEmployee(data: {
    employeeId: string;
    fullName: string;
    email: string;
    orgUnitId: number;
  }): Promise<Employee> {
    try {
      return await this.db.employee.create({
        data: {
          employeeId: data.employeeId,
          fullName: data.fullName,
          email: data.email,
          orgUnitId: data.orgUnitId,
          effectiveRoles: ['USER'],
          effectiveFrom: new Date(),
          isActive: true,
          createdBy: 'SYSTEM-SSO',
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error creating employee',
        error instanceof Error ? error.stack : undefined,
        'AuthRepository.createEmployee',
      );
      throw error;
    }
  }

  /**
   * Upsert SSO User (Employee + Account + Role + OrgUnit + Optional Driver)
   */
  async upsertSSOUser(data: {
    employeeId: string;
    fullName: string;
    email: string;
    passwordHash: string;
    department?: string;
    division?: string;
    userType?: 'Internal' | 'External';
    roleName?: string;
    position?: string;
    phoneNumber?: string;
    photoUrl?: string;
    vendorName?: string;
  }): Promise<Employee & { account: Account | null; driverProfile: Driver | null; effectiveRoles: Role[] }> {
    try {
      return await this.db.$transaction(async (tx) => {
        // 1. Resolve Org Unit (Find by Dept/Div or create default)
        let orgUnitId = 1; // Fallback
        const orgName = data.department || data.division || 'SSO_Import';

        const existingOrg = await tx.organizationUnit.findFirst({
          where: { name: { contains: orgName, mode: 'insensitive' }, deletedAt: null },
        });

        if (existingOrg) {
          orgUnitId = existingOrg.id;
        } else {
          // Create Default SSO Unit if not exists
          const newOrg = await tx.organizationUnit.create({
            data: {
              name: orgName,
              code: `SSO-${Date.now().toString().slice(-4)}`, // Simple unique code
              type: 'DEPARTMENT',
              createdBy: 'SYSTEM-SSO',
            },
          });
          orgUnitId = newOrg.id;
        }

        // 2. Upsert Employee
        const employee: Employee & { account: Account | null; driverProfile: Driver | null } = (await tx.employee.upsert({
          where: { employeeId: data.employeeId },
          update: {
            fullName: data.fullName,
            email: data.email,
            orgUnitId: orgUnitId,
            phoneNumber: data.phoneNumber,
            photoUrl: data.photoUrl,
            position: data.position,
            userType: data.userType,
            vendorName: data.vendorName,
            updatedBy: 'SYSTEM-SSO',
          },
          create: {
            employeeId: data.employeeId,
            fullName: data.fullName,
            email: data.email,
            orgUnitId: orgUnitId,
            phoneNumber: data.phoneNumber,
            photoUrl: data.photoUrl,
            position: data.position,
            userType: data.userType,
            vendorName: data.vendorName,
            effectiveRoles: ['USER'], // Default role for new users
            effectiveFrom: new Date(),
            isActive: true,
            createdBy: 'SYSTEM-SSO',
          },
          include: {
            driverProfile: true,
            account: true,
          },
        })) as unknown as Employee & { account: Account | null; driverProfile: Driver | null };

        // 3. Upsert Account
        let account = employee.account;
        if (!account) {
          account = await tx.account.create({
            data: {
              email: data.email,
              password: data.passwordHash,
              employeeId: data.employeeId,
              isVerified: true,
            },
          });
        } else {
          // Optionally update email/password if policy dictates
          // For now, we trust SSO email
          if (account.email !== data.email) {
            await tx.account.update({
              where: { id: account.id },
              data: { email: data.email },
            });
            account.email = data.email;
          }
        }

        // 4. Role Assignment
        const roleName = data.roleName || 'USER';
        const targetRole = await tx.rBACRole.findFirst({
          where: { name: { equals: roleName, mode: 'insensitive' } },
        });

        const roleToAssign = targetRole || (await tx.rBACRole.findFirst({ where: { name: 'USER' } }));

        if (roleToAssign) {
          const hasRole = await tx.userRole.findFirst({
            where: { employeeId: data.employeeId, roleId: roleToAssign.id },
          });

          if (!hasRole) {
            await tx.userRole.create({
              data: {
                employeeId: data.employeeId,
                roleId: roleToAssign.id,
                assignedBy: 'SYSTEM-SSO',
              },
            });
          }
        }

        // 5. Driver Logic (Removed as per USER REQUEST: drivers are created manually by GA)
        const driverProfile = employee.driverProfile;

        return {
          ...employee,
          account,
          driverProfile,
        };
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error upserting SSO user',
        error instanceof Error ? error.stack : undefined,
        'AuthRepository.upsertSSOUser',
      );
      throw error;
    }
  }

  /**
   * Validate SSO token with external provider
   */
  async validateSSOToken(token: string): Promise<ISsoCheckToken> {
    try {
      const ssoApiUrl = this.configService.get<string>('SSO_API_URL');
      const validationEndpoint = this.configService.get<string>('SSO_VALIDATION_ENDPOINT');

      if (!ssoApiUrl || !validationEndpoint) {
        throw new Error('SSO Configuration missing in Repository');
      }

      const response = await axios.get(`${ssoApiUrl}${validationEndpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: { token },
        timeout: 5000,
      });

      return response?.data?.user;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error validating SSO token',
        error instanceof Error ? error.stack : undefined,
        'AuthRepository.validateSSOToken',
      );
      throw error;
    }
  }
}
