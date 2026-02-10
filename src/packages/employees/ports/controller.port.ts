import { ResponseREST } from '@/shared/utils/rest-api/types';
import { Response } from 'express';
import { IEmployeeSearchResponse } from '../domain/response';

export interface EmployeesControllerPort {
  search(q: string, res: Response): Promise<Response<ResponseREST<IEmployeeSearchResponse[]>>>;
}
