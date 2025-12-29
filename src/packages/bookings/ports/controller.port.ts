import { Response } from 'express';
import { ResponseREST } from '@/shared/utils/rest-api/types';
import { IAvailableVehicle, IBooking, IBookingListResponse } from '../domain/response';

export interface BookingsControllerPort {
  create(body: any, userId: string, res: Response): Promise<Response<ResponseREST<IBooking>>>;

  findAll(query: any, userId: string, res: Response): Promise<Response<ResponseREST<IBookingListResponse>>>;

  findAvailableVehicles(query: any, userId: string, res: Response): Promise<Response<ResponseREST<IAvailableVehicle[]>>>;
}
