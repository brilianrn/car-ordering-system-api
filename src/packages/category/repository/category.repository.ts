import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { Injectable } from '@nestjs/common';
import { Category, CategoryScope, Prisma, PrismaClient } from '@prisma/client';
import { CategoryRepositoryPort } from '../ports/repository.port';

@Injectable()
export class CategoryRepository implements CategoryRepositoryPort {
  private readonly db: PrismaClient = clientDb;

  create = async (data: Prisma.CategoryCreateInput): Promise<any> => {
    try {
      return await this.db.category.create({
        data,
      });
    } catch (error: any) {
      // Check if it's a unique constraint error on id (sequence issue)
      if (error?.code === 'P2002' && error?.meta?.target?.includes('id')) {
        Logger.error(
          'Database sequence issue detected for category table. Sequence is out of sync with existing data.',
          error?.stack,
          'CategoryRepository.create',
        );
        Logger.error(
          'To fix this, run the following SQL query in your database:',
          undefined,
          'CategoryRepository.create',
        );
        Logger.error(
          "SELECT setval('category_id_seq', COALESCE((SELECT MAX(id) FROM category), 0) + 1);",
          undefined,
          'CategoryRepository.create',
        );
        // Throw a more user-friendly error
        throw new Error(
          'Database sequence error. Please contact administrator to fix sequence. Error: Unique constraint failed on id field. This usually happens when sequence is out of sync with existing data.',
        );
      }

      Logger.error(
        error instanceof Error ? error.message : 'Error in create',
        error instanceof Error ? error.stack : undefined,
        'CategoryRepository.create',
      );
      throw error;
    }
  };

  findById = async (id: number): Promise<any | null> => {
    try {
      return await this.db.category.findFirst({
        where: {
          id,
          deletedAt: null,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findById',
        error instanceof Error ? error.stack : undefined,
        'CategoryRepository.findById',
      );
      throw error;
    }
  };

  findByCode = async (code: string): Promise<any | null> => {
    try {
      return await this.db.category.findFirst({
        where: {
          code: code.toUpperCase(),
          deletedAt: null,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findByCode',
        error instanceof Error ? error.stack : undefined,
        'CategoryRepository.findByCode',
      );
      throw error;
    }
  };

  findByName = async (name: string): Promise<any | null> => {
    try {
      return await this.db.category.findFirst({
        where: {
          name: {
            equals: name,
            mode: 'insensitive',
          },
          deletedAt: null,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findByName',
        error instanceof Error ? error.stack : undefined,
        'CategoryRepository.findByName',
      );
      throw error;
    }
  };

  findMany = async (params: {
    skip: number;
    take: number;
    where?: Prisma.CategoryWhereInput;
    orderBy?: Prisma.CategoryOrderByWithRelationInput | Prisma.CategoryOrderByWithRelationInput[];
  }): Promise<any[]> => {
    try {
      return await this.db.category.findMany({
        skip: params.skip,
        take: params.take,
        where: {
          ...params.where,
          deletedAt: null,
        },
        orderBy: params.orderBy || [{ displayOrder: 'asc' }, { code: 'asc' }],
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findMany',
        error instanceof Error ? error.stack : undefined,
        'CategoryRepository.findMany',
      );
      throw error;
    }
  };

  count = async (where?: Prisma.CategoryWhereInput): Promise<number> => {
    try {
      return await this.db.category.count({
        where: {
          ...where,
          deletedAt: null,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in count',
        error instanceof Error ? error.stack : undefined,
        'CategoryRepository.count',
      );
      throw error;
    }
  };

  update = async (id: number, data: Prisma.CategoryUpdateInput): Promise<any> => {
    try {
      return await this.db.category.update({
        where: { id },
        data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in update',
        error instanceof Error ? error.stack : undefined,
        'CategoryRepository.update',
      );
      throw error;
    }
  };

  hasBookings = async (id: number): Promise<boolean> => {
    try {
      const count = await this.db.booking.count({
        where: {
          categoryId: id,
          deletedAt: null,
        },
      });
      return count > 0;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in hasBookings',
        error instanceof Error ? error.stack : undefined,
        'CategoryRepository.hasBookings',
      );
      throw error;
    }
  };

  findActiveCategoriesForBooking = async (params: {
    orgUnitCode?: string;
    paramSetCategoryIds?: number[];
  }): Promise<any[]> => {
    try {
      const where: Prisma.CategoryWhereInput = {
        status: 'ACTIVE',
        deletedAt: null,
      };

      // Scope filtering: jika orgUnitCode ada, filter berdasarkan scope
      if (params.orgUnitCode) {
        // Jika scope DIVISI, cek apakah orgUnitCode sesuai dengan divisi
        // Untuk sementara, kita asumsikan scope DIVISI berarti semua divisi bisa akses
        // Implementasi lebih detail bisa ditambahkan sesuai kebutuhan bisnis
        where.OR = [{ scope: CategoryScope.GLOBAL }, { scope: CategoryScope.PLANT }, { scope: CategoryScope.DIVISI }];
      } else {
        // Jika tidak ada orgUnitCode, hanya tampilkan GLOBAL
        where.scope = CategoryScope.GLOBAL;
      }

      // Double-gate visibility: hanya kategori yang ada di ParamSet Published
      if (params.paramSetCategoryIds && params.paramSetCategoryIds.length > 0) {
        where.id = {
          in: params.paramSetCategoryIds,
        };
      } else {
        // Jika tidak ada paramSetCategoryIds, return empty array (tidak ada kategori yang eligible)
        return [];
      }

      return await this.db.category.findMany({
        where,
        orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findActiveCategoriesForBooking',
        error instanceof Error ? error.stack : undefined,
        'CategoryRepository.findActiveCategoriesForBooking',
      );
      throw error;
    }
  };

  findLovCategories = async (): Promise<Category[]> => {
    try {
      return await this.db.category.findMany({
        where: {
          deletedAt: null,
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findLovCategories',
        error instanceof Error ? error.stack : undefined,
        'CategoryRepository.findLovCategories',
      );
      throw error;
    }
  };
}
