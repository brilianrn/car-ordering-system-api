import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Category, CategoryScope, CategoryStatus, Prisma } from '@prisma/client';
import { ICategoryListResponse } from '../domain/response';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { QueryCategoryDto } from '../dto/query-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { CategoryRepositoryPort } from '../ports/repository.port';
import { CategoryUsecasePort } from '../ports/usecase.port';

@Injectable()
export class CategoryUseCase implements CategoryUsecasePort {
  private readonly db = clientDb;

  constructor(
    @Inject('CategoryRepositoryPort')
    private readonly repository: CategoryRepositoryPort,
  ) {}

  create = async (dto: CreateCategoryDto, userId: string): Promise<IUsecaseResponse<any>> => {
    try {
      let categoryCode: string;

      // 1. Handle code: if provided, validate; if not, auto-generate
      if (dto.code) {
        // Validate code format (uppercase, no spaces)
        const code = dto.code.toUpperCase().trim();
        if (code.length < 2 || code.length > 12) {
          return {
            error: {
              message: 'Category code must be between 2 and 12 characters',
              code: HttpStatus.BAD_REQUEST,
            },
          };
        }

        if (!/^[A-Z0-9_]+$/.test(code)) {
          return {
            error: {
              message: 'Category code must be uppercase alphanumeric with underscores, no spaces',
              code: HttpStatus.BAD_REQUEST,
            },
          };
        }

        // Check code uniqueness
        const existingByCode = await this.repository.findByCode(code);
        if (existingByCode) {
          return {
            error: {
              message: `Category with code ${code} already exists`,
              code: HttpStatus.CONFLICT,
            },
          };
        }

        categoryCode = code;
      } else {
        // Auto-generate unique code
        const generatedCode = await this.generateCategoryCode();
        if (!generatedCode) {
          return {
            error: {
              message: 'Failed to generate category code',
              code: HttpStatus.INTERNAL_SERVER_ERROR,
            },
          };
        }
        categoryCode = generatedCode;
      }

      // 2. Check name uniqueness (case-insensitive)
      const existingByName = await this.repository.findByName(dto.name);
      if (existingByName) {
        return {
          error: {
            message: `Category with name ${dto.name} already exists`,
            code: HttpStatus.CONFLICT,
          },
        };
      }

      // 3. Create category
      const category = await this.repository.create({
        code: categoryCode,
        name: dto.name.trim(),
        status: dto.status || CategoryStatus.ACTIVE,
        displayOrder: dto.displayOrder ?? 0,
        scope: dto.scope || CategoryScope.GLOBAL,
        createdBy: userId,
      });

      // 5. Log audit trail
      await this.logAudit('CREATE', category.id, userId, null, category);

      return { data: category };
    } catch (error: any) {
      // Check if it's a sequence error
      if (error?.message?.includes('sequence') || error?.message?.includes('Unique constraint failed on id')) {
        Logger.error(
          'Category sequence error detected. Database sequence needs to be reset.',
          error?.stack,
          'CategoryUseCase.create',
        );
        return {
          error: {
            message:
              "Database sequence error. Please contact administrator. The category sequence needs to be reset. Run: SELECT setval('category_id_seq', COALESCE((SELECT MAX(id) FROM category), 0) + 1);",
            code: HttpStatus.INTERNAL_SERVER_ERROR,
          },
        };
      }

      Logger.error(
        error instanceof Error ? error.message : 'Error in create',
        error instanceof Error ? error.stack : undefined,
        'CategoryUseCase.create',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to create category',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  findAll = async (query: QueryCategoryDto): Promise<IUsecaseResponse<ICategoryListResponse>> => {
    try {
      const { page = 1, limit = 10 } = query;
      const skip = (page - 1) * limit;

      const where: Prisma.CategoryWhereInput = {};

      // Search by code or name
      if (query.search) {
        where.OR = [
          {
            code: {
              contains: query.search.toUpperCase(),
              mode: 'insensitive',
            },
          },
          {
            name: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
        ];
      }

      // Filter by status
      if (query.status) {
        where.status = query.status;
      }

      // Filter by scope
      if (query.scope) {
        where.scope = query.scope;
      }

      const [data, total] = await Promise.all([
        this.repository.findMany({
          skip,
          take: limit,
          where,
        }),
        this.repository.count(where),
      ]);

      return {
        data: {
          data,
          meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findAll',
        error instanceof Error ? error.stack : undefined,
        'CategoryUseCase.findAll',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to fetch categories',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  findOne = async (id: number): Promise<IUsecaseResponse<any>> => {
    try {
      const category = await this.repository.findById(id);
      if (!category) {
        return {
          error: {
            message: `Category with ID ${id} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      return { data: category };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findOne',
        error instanceof Error ? error.stack : undefined,
        'CategoryUseCase.findOne',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to fetch category',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  update = async (id: number, dto: UpdateCategoryDto, userId: string): Promise<IUsecaseResponse<any>> => {
    try {
      // 1. Get existing category
      const existing = await this.repository.findById(id);
      if (!existing) {
        return {
          error: {
            message: `Category with ID ${id} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // 2. Check name uniqueness if name is being updated
      if (dto.name) {
        const existingByName = await this.repository.findByName(dto.name);
        if (existingByName && existingByName.id !== id) {
          return {
            error: {
              message: `Category with name ${dto.name} already exists`,
              code: HttpStatus.CONFLICT,
            },
          };
        }
      }

      // 3. Prepare update data
      const updateData: Prisma.CategoryUpdateInput = {};
      if (dto.name !== undefined) {
        updateData.name = dto.name.trim();
      }
      if (dto.status !== undefined) {
        updateData.status = dto.status;
      }
      if (dto.displayOrder !== undefined) {
        updateData.displayOrder = dto.displayOrder;
      }
      if (dto.scope !== undefined) {
        updateData.scope = dto.scope;
      }
      updateData.updatedBy = userId;

      // 4. Track changes for audit
      const beforeAfter: any = {};
      if (dto.status !== undefined && dto.status !== existing.status) {
        beforeAfter.status = { before: existing.status, after: dto.status };
      }
      if (dto.scope !== undefined && dto.scope !== existing.scope) {
        beforeAfter.scope = { before: existing.scope, after: dto.scope };
      }
      if (dto.name !== undefined && dto.name !== existing.name) {
        beforeAfter.name = { before: existing.name, after: dto.name };
      }
      if (dto.displayOrder !== undefined && dto.displayOrder !== existing.displayOrder) {
        beforeAfter.displayOrder = { before: existing.displayOrder, after: dto.displayOrder };
      }

      // 5. Update category
      const updated = await this.repository.update(id, updateData);

      // 6. Log audit trail
      if (Object.keys(beforeAfter).length > 0) {
        await this.logAudit('UPDATE', id, userId, existing, updated);
      }

      return { data: updated };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in update',
        error instanceof Error ? error.stack : undefined,
        'CategoryUseCase.update',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to update category',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  delete = async (id: number, userId: string): Promise<IUsecaseResponse<any>> => {
    try {
      // 1. Get existing category
      const existing = await this.repository.findById(id);
      if (!existing) {
        return {
          error: {
            message: `Category with ID ${id} not found`,
            code: HttpStatus.NOT_FOUND,
          },
        };
      }

      // 2. Hard Delete Forbidden: Check if category has bookings
      const hasBookings = await this.repository.hasBookings(id);
      if (hasBookings) {
        return {
          error: {
            message: 'Cannot delete category that has transaction history. Use status "INACTIVE" instead.',
            code: HttpStatus.BAD_REQUEST,
          },
        };
      }

      // 3. Soft delete (set deletedAt)
      const updated = await this.repository.update(id, {
        deletedAt: new Date(),
        deletedBy: userId,
        updatedBy: userId,
      });

      // 4. Log audit trail
      await this.logAudit('DELETE', id, userId, existing, updated);

      return { data: { message: 'Category deleted successfully' } };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in delete',
        error instanceof Error ? error.stack : undefined,
        'CategoryUseCase.delete',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to delete category',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  exportToCsv = async (): Promise<IUsecaseResponse<string>> => {
    try {
      // 1. Get all categories
      const categories = await this.repository.findMany({
        skip: 0,
        take: 10000, // Large limit for export
        where: {},
      });

      // 2. Generate CSV with watermark and timestamp
      const timestamp = new Date().toISOString();
      const watermark = `Car Ordering System - Category Export`;
      const header = `${watermark}\nGenerated at: ${timestamp}\n\n`;

      const csvHeader = 'ID,Code,Name,Status,Display Order,Scope,Created At,Created By,Updated At,Updated By\n';
      const csvRows = categories
        .map((cat) => {
          // Safe handling for null/undefined values
          const escapeCsv = (value: any): string => {
            if (value === null || value === undefined) return '';
            const str = String(value);
            return `"${str.replace(/"/g, '""')}"`; // Escape quotes in CSV
          };

          return [
            cat.id ?? '',
            cat.code ?? '',
            escapeCsv(cat.name),
            cat.status ?? '',
            cat.displayOrder ?? 0,
            cat.scope ?? '',
            cat.createdAt ? new Date(cat.createdAt).toISOString() : '',
            cat.createdBy ?? '',
            cat.updatedAt ? new Date(cat.updatedAt).toISOString() : '',
            cat.updatedBy ?? '',
          ].join(',');
        })
        .join('\n');

      const csv = header + csvHeader + csvRows;

      return { data: csv };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in exportToCsv',
        error instanceof Error ? error.stack : undefined,
        'CategoryUseCase.exportToCsv',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to export categories',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  findActiveCategoriesForBooking = async (): Promise<IUsecaseResponse<Category[]>> => {
    try {
      const categories = await this.repository.findLovCategories();
      return { data: categories };

      // // 1. Get published ParamSet
      // const publishedParamSet = await this.db.paramSet.findFirst({
      //   where: {
      //     status: ParamSetStatus.PUBLISHED,
      //     deletedAt: null,
      //   },
      //   include: {
      //     items: {
      //       where: {
      //         group: ParamGroup.KATEGORI, // Using KATEGORI enum value
      //         deletedAt: null,
      //       },
      //     },
      //   },
      //   orderBy: {
      //     version: 'desc',
      //   },
      // });

      // if (!publishedParamSet) {
      //   return {
      //     data: [],
      //   };
      // }

      // // 2. Extract category IDs from ParamSet items
      // // Assuming ParamItem.value contains category ID or code
      // // This might need adjustment based on actual ParamSet structure
      // const categoryIds: number[] = [];
      // for (const item of publishedParamSet.items) {
      //   const categoryId = parseInt(item.value, 10);
      //   if (!isNaN(categoryId)) {
      //     categoryIds.push(categoryId);
      //   } else {
      //     // If value is code, find by code
      //     const category = await this.repository.findByCode(item.value);
      //     if (category) {
      //       categoryIds.push(category.id);
      //     }
      //   }
      // }

      // // 3. Get active categories with double-gate visibility
      // const categories = await this.repository.findActiveCategoriesForBooking({
      //   orgUnitCode,
      //   paramSetCategoryIds: categoryIds,
      // });

      // return { data: categories };
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findActiveCategoriesForBooking',
        error instanceof Error ? error.stack : undefined,
        'CategoryUseCase.findActiveCategoriesForBooking',
      );
      return {
        error: {
          message: error instanceof Error ? error.message : 'Failed to fetch active categories',
          code: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }
  };

  private logAudit = async (
    action: string,
    entityId: number,
    userId: string,
    before: any,
    after: any,
  ): Promise<void> => {
    try {
      const beforeAfter: any = {};
      if (before) {
        beforeAfter.before = {
          code: before.code,
          name: before.name,
          status: before.status,
          scope: before.scope,
          displayOrder: before.displayOrder,
        };
      }
      if (after) {
        beforeAfter.after = {
          code: after.code,
          name: after.name,
          status: after.status,
          scope: after.scope,
          displayOrder: after.displayOrder,
        };
      }

      await this.db.auditLog.create({
        data: {
          userNik: userId,
          featureCode: 'FR-SET-007',
          action,
          entityType: 'Category',
          entityId,
          beforeAfter: beforeAfter as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      Logger.warn(
        `Failed to log audit trail: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CategoryUseCase.logAudit',
      );
    }
  };

  private generateCategoryCode = async (): Promise<string | null> => {
    try {
      // Generate code format: CAT_001, CAT_002, etc.
      const prefix = 'CAT';
      let sequence = 1;
      let code = `${prefix}_${sequence.toString().padStart(3, '0')}`;
      let isUnique = false;
      const maxAttempts = 1000;

      while (!isUnique && sequence <= maxAttempts) {
        const existing = await this.repository.findByCode(code);
        if (!existing) {
          isUnique = true;
        } else {
          sequence++;
          code = `${prefix}_${sequence.toString().padStart(3, '0')}`;
        }
      }

      if (!isUnique) {
        Logger.error(
          'Failed to generate unique category code after max attempts',
          'CategoryUseCase.generateCategoryCode',
        );
        return null;
      }

      return code;
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in generateCategoryCode',
        error instanceof Error ? error.stack : undefined,
        'CategoryUseCase.generateCategoryCode',
      );
      return null;
    }
  };
}
