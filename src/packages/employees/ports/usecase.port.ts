import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { IEmployeeSearchResponse } from '../domain/response';

export interface EmployeesUsecasePort {
  search(query: string, roles?: string[]): Promise<IUsecaseResponse<IEmployeeSearchResponse[]>>;
}
