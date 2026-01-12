import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { CreateCostSetDto } from '../dto/create-cost-set.dto';
import { EstimateCostDto } from '../dto/estimate-cost.dto';
import { PublishCostSetDto } from '../dto/publish-cost-set.dto';
import { QueryCostSetDto } from '../dto/query-cost-set.dto';
import { UpdateCostSetDto } from '../dto/update-cost-set.dto';
import { ICostSetListResponse, IEstimateCostResponse } from '../domain/response';

export interface CostSetUsecasePort {
  create(dto: CreateCostSetDto, userId: string): Promise<IUsecaseResponse<any>>;
  findAll(query: QueryCostSetDto): Promise<IUsecaseResponse<ICostSetListResponse>>;
  findOne(id: number): Promise<IUsecaseResponse<any>>;
  findByVersion(version: number): Promise<IUsecaseResponse<any>>;
  update(id: number, dto: UpdateCostSetDto, userId: string): Promise<IUsecaseResponse<any>>;
  publish(id: number, dto: PublishCostSetDto, userId: string): Promise<IUsecaseResponse<any>>;
  retire(id: number, userId: string, notes?: string): Promise<IUsecaseResponse<any>>;
  estimateCost(dto: EstimateCostDto): Promise<IUsecaseResponse<IEstimateCostResponse>>;
  exportToCsv(): Promise<IUsecaseResponse<string>>;
}
