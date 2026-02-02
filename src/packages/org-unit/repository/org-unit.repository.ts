import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { Injectable } from '@nestjs/common';
import { OrganizationUnit, Prisma, PrismaClient } from '@prisma/client';
import { OrgUnitRepositoryPort } from '../ports';

@Injectable()
export class OrgUnitRepository implements OrgUnitRepositoryPort {
  private readonly db: PrismaClient = clientDb;

  /**
   * Find organization units with optional filters
   */
  async findMany(where?: Prisma.OrganizationUnitWhereInput): Promise<OrganizationUnit[]> {
    try {
      return await this.db.organizationUnit.findMany({
        where: {
          ...where,
          deletedAt: null, // Always exclude soft-deleted records
        },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findMany',
        error instanceof Error ? error.stack : undefined,
        'OrgUnitRepository.findMany',
      );
      throw error;
    }
  }

  /**
   * Find all organization units (for tree building)
   */
  async findAll(): Promise<OrganizationUnit[]> {
    try {
      return await this.db.organizationUnit.findMany({
        where: {
          deletedAt: null,
        },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findAll',
        error instanceof Error ? error.stack : undefined,
        'OrgUnitRepository.findAll',
      );
      throw error;
    }
  }

  /**
   * Find organization unit by code
   */
  async findByCode(code: string): Promise<OrganizationUnit | null> {
    try {
      return await this.db.organizationUnit.findUnique({
        where: {
          code,
          deletedAt: null,
        },
        include: {
          parent: {
            select: {
              code: true,
              name: true,
              type: true,
            },
          },
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findByCode',
        error instanceof Error ? error.stack : undefined,
        'OrgUnitRepository.findByCode',
      );
      throw error;
    }
  }

  /**
   * Count organization units with optional filters
   */
  async count(where?: Prisma.OrganizationUnitWhereInput): Promise<number> {
    try {
      return await this.db.organizationUnit.count({
        where: {
          ...where,
          deletedAt: null,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in count',
        error instanceof Error ? error.stack : undefined,
        'OrgUnitRepository.count',
      );
      throw error;
    }
  }
}
