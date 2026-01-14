import { clientDb } from '@/shared/utils';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class AuthRepository {
  private readonly db: PrismaClient = clientDb;

  findByEmail(email: string) {
    return this.db.employee.findUnique({
      where: { email },
    });
  }

  createUser(data: any) {
    return this.db.employee.create({
      data,
    });
  }

  searchUsers(params: { query?: string; employeeId?: string; email?: string; fullName?: string; limit?: number }) {
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
    });
  }
}
