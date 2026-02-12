import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { Pagination } from '@/shared/utils/rest-api/pagination';
import { IPaginationResponse } from '@/shared/utils/rest-api/types';
import { Injectable } from '@nestjs/common';
import { OrganizationUnit, Prisma, PrismaClient } from '@prisma/client';
import { GetOrgUnitsDto } from '../dto';
import { OrgUnitRepositoryPort } from '../ports';

@Injectable()
export class OrgUnitRepository implements OrgUnitRepositoryPort {
  private readonly db: PrismaClient = clientDb;

  async findAllPaginated(
    query: GetOrgUnitsDto,
  ): Promise<IPaginationResponse<OrganizationUnit & { parent: OrganizationUnit | null }>> {
    try {
      const { page = 1, limit = 10, search, type, orderBy, orderDirection } = query;
      const skip = (page - 1) * limit;

      const where: Prisma.OrganizationUnitWhereInput = {
        deletedAt: null,
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (type) {
        where.type = type;
      }

      const [count, rows] = await Promise.all([
        this.db.organizationUnit.count({ where }),
        this.db.organizationUnit.findMany({
          where,
          skip,
          take: limit,
          orderBy: orderBy ? { [orderBy]: orderDirection || 'asc' } : [{ type: 'asc' }, { name: 'asc' }],
          include: {
            parent: true,
          },
        }),
      ]);

      return new Pagination(page, limit).paginate({ count, rows });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findAllPaginated',
        error instanceof Error ? error.stack : undefined,
        'OrgUnitRepository.findAllPaginated',
      );
      throw error;
    }
  }

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
