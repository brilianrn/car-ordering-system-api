import { Category, Prisma } from '@prisma/client';

export interface CategoryRepositoryPort {
  create(data: Prisma.CategoryCreateInput): Promise<any>;
  findById(id: number): Promise<any | null>;
  findByCode(code: string): Promise<any | null>;
  findByName(name: string): Promise<any | null>;
  findMany(params: {
    skip: number;
    take: number;
    where?: Prisma.CategoryWhereInput;
    orderBy?: Prisma.CategoryOrderByWithRelationInput | Prisma.CategoryOrderByWithRelationInput[];
  }): Promise<any[]>;
  count(where?: Prisma.CategoryWhereInput): Promise<number>;
  update(id: number, data: Prisma.CategoryUpdateInput): Promise<any>;
  hasBookings(id: number): Promise<boolean>;
  findActiveCategoriesForBooking(params: { orgUnitCode?: string; paramSetCategoryIds?: number[] }): Promise<any[]>;
  findLovCategories(): Promise<Category[]>;
}
