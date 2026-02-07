import { clientDb } from '@/shared/utils';
import { Injectable } from '@nestjs/common';
import { Account, Employee, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { AuthRepositoryPort } from '../ports/repository.port';

@Injectable()
export class AuthRepository implements AuthRepositoryPort {
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
      return null;
    }
  }

  /**
   * Find employee by NIK (Employee ID)
   */
  async findEmployeeByNik(nik: string): Promise<(Employee & { orgUnit: any }) | null> {
    try {
      return await this.db.employee.findUnique({
        where: { employeeId: nik },
        include: {
          orgUnit: true,
        },
      });
    } catch (error) {
      return null;
    }
  }

  /**
   * Find account by email
   */
  async findAccountByEmail(email: string): Promise<(Account & { employee: Employee & { orgUnit: any } }) | null> {
    try {
      return await this.db.account.findUnique({
        where: { email },
        include: {
          employee: {
            include: {
              orgUnit: true,
            },
          },
        },
      });
    } catch (error) {
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
    return this.db.account.create({
      data: {
        email: data.email,
        password: data.password,
        employeeId: data.employeeId,
        isVerified: data.isVerified ?? false,
        verificationToken: data.verificationToken,
      },
    });
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
      return null;
    }
  }

  /**
   * Update account verification (set isVerified = true, remove token)
   */
  async updateAccountVerification(id: number): Promise<Account> {
    return this.db.account.update({
      where: { id },
      data: {
        isVerified: true,
        verificationToken: null,
      },
    });
  }

  /**
   * Create placeholder employee for glondongan mode
   */
  async createPlaceholderEmployee(data: { employeeId: string; email: string; fullName: string }): Promise<Employee> {
    // Dynamically find a valid org unit to avoid foreign key constraint errors
    let orgUnitId = 1;
    const defaultOrgUnit = await this.db.organizationUnit.findFirst({
      where: { deletedAt: null },
      select: { id: true },
    });

    if (defaultOrgUnit) {
      orgUnitId = defaultOrgUnit.id;
    }

    return this.db.employee.create({
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
  }

  /**
   * Search users (for autocomplete/search functionality)
   */
  async searchUsers(params: {
    query?: string;
    employeeId?: string;
    email?: string;
    fullName?: string;
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
    const { query, employeeId, email, fullName, limit = 50 } = params;

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

    return this.db.employee.findMany({
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
    }) as Promise<
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
    >;
  }

  /**
   * Create SSO account (no password, auto-verified)
   */
  async createSsoAccount(data: { email: string; employeeId: string }): Promise<Account> {
    // Generate a random password hash (never used, but required by schema)
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    return this.db.account.create({
      data: {
        email: data.email,
        password: hashedPassword,
        employeeId: data.employeeId,
        isVerified: true, // SSO users are auto-verified
        verificationToken: null,
      },
    });
  }
}
