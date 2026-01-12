import { Category, CategoryScope, CategoryStatus } from '@prisma/client';

export interface ICategory extends Category {
  status: CategoryStatus;
  scope: CategoryScope;
}

export interface ICategoryListResponse {
  data: ICategory[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
