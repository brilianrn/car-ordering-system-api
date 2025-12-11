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
}
