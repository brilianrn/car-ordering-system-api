import { clientDb } from '@/shared/utils';
import { Injectable } from '@nestjs/common';
import { Account, Employee, PrismaClient } from '@prisma/client';
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
  }): Promise<Account> {
    return this.db.account.create({
      data: {
        email: data.email,
        password: data.password,
        employeeId: data.employeeId,
        isVerified: data.isVerified ?? false,
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
}
