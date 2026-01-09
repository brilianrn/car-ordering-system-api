import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { ICostVariable, ICostVariableListResponse } from '../domain/response';
import { CreateCostVariableDto } from '../dto/create-cost-variable.dto';
import { QueryCostVariableDto } from '../dto/query-cost-variable.dto';
import { UpdateCostVariableDto } from '../dto/update-cost-variable.dto';

export interface CostVariableUsecasePort {
  create: (createDto: CreateCostVariableDto, userId: string) => Promise<IUsecaseResponse<ICostVariable>>;
  findAll: (query: QueryCostVariableDto) => Promise<IUsecaseResponse<ICostVariableListResponse>>;
  findOne: (id: number) => Promise<IUsecaseResponse<ICostVariable>>;
  update: (id: number, updateDto: UpdateCostVariableDto, userId: string) => Promise<IUsecaseResponse<ICostVariable>>;
  delete: (id: number, userId: string) => Promise<IUsecaseResponse<void>>;
  restore: (id: number) => Promise<IUsecaseResponse<ICostVariable>>;
}
