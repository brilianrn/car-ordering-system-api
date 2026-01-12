import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { CreateParamSetDto, PublishParamSetDto, QueryParamSetDto, RollbackParamSetDto } from '../dto';

export interface ParamSetUsecasePort {
  createDraft(dto: CreateParamSetDto, userId: string, ipAddress?: string): Promise<IUsecaseResponse<any>>;

  findActive(environment: string): Promise<IUsecaseResponse<any>>;

  findMany(query: QueryParamSetDto): Promise<IUsecaseResponse<any>>;

  findById(id: string): Promise<IUsecaseResponse<any>>;

  publish(id: string, dto: PublishParamSetDto, userId: string, ipAddress?: string): Promise<IUsecaseResponse<any>>;

  rollback(id: string, dto: RollbackParamSetDto, userId: string, ipAddress?: string): Promise<IUsecaseResponse<any>>;
}
