import { Response } from 'express';
import { CreateCategoryDto, QueryCategoryDto, UpdateCategoryDto } from '../dto';

export interface CategoryControllerPort {
  create(dto: CreateCategoryDto, userId: string, res: Response): Promise<void>;
  findAll(query: QueryCategoryDto, res: Response): Promise<void>;
  findOne(id: number, res: Response): Promise<void>;
  update(id: number, dto: UpdateCategoryDto, userId: string, res: Response): Promise<void>;
  delete(id: number, userId: string, res: Response): Promise<void>;
  exportToCsv(res: Response): Promise<void>;
  findActiveCategoriesForBooking(orgUnitCode: string | undefined, res: Response): Promise<void>;
}
