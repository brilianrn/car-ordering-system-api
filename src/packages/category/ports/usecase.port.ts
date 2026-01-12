import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { QueryCategoryDto } from '../dto/query-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { ICategoryListResponse } from '../domain/response';

export interface CategoryUsecasePort {
  create(dto: CreateCategoryDto, userId: string): Promise<IUsecaseResponse<any>>;
  findAll(query: QueryCategoryDto): Promise<IUsecaseResponse<ICategoryListResponse>>;
  findOne(id: number): Promise<IUsecaseResponse<any>>;
  update(id: number, dto: UpdateCategoryDto, userId: string): Promise<IUsecaseResponse<any>>;
  delete(id: number, userId: string): Promise<IUsecaseResponse<any>>;
  exportToCsv(): Promise<IUsecaseResponse<string>>;
  findActiveCategoriesForBooking(orgUnitCode?: string): Promise<IUsecaseResponse<any[]>>;
}
