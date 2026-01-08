import { Response } from 'express';
import { ResponseREST } from '@/shared/utils/rest-api/types';
import { ICostVariable, ICostVariableListResponse } from '../domain/response';
import { CreateCostVariableDto } from '../dto/create-cost-variable.dto';
import { QueryCostVariableDto } from '../dto/query-cost-variable.dto';
import { UpdateCostVariableDto } from '../dto/update-cost-variable.dto';

export interface CostVariableControllerPort {
  create(body: CreateCostVariableDto, userId: string, res: Response): Promise<Response<ResponseREST<ICostVariable>>>;
  findAll(query: QueryCostVariableDto, res: Response): Promise<Response<ResponseREST<ICostVariableListResponse>>>;
  findOne(id: number, res: Response): Promise<Response<ResponseREST<ICostVariable>>>;
  update(id: number, body: UpdateCostVariableDto, userId: string, res: Response): Promise<Response<ResponseREST<ICostVariable>>>;
  delete(id: number, userId: string, res: Response): Promise<Response<ResponseREST<void>>>;
  restore(id: number, res: Response): Promise<Response<ResponseREST<ICostVariable>>>;
}

