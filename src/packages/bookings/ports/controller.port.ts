import { ResponseREST } from '@/shared/utils/rest-api/types';
import { Response } from 'express';
import { IAvailableVehicle, IBooking, IBookingListResponse, ITripDetail } from '../domain/response';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { QueryAvailableVehiclesDto } from '../dto/query-available-vehicles.dto';
import { QueryBookingDto } from '../dto/query-booking.dto';
import { UpdateBookingDto } from '../dto/update-booking.dto';

export interface BookingsControllerPort {
  create(body: CreateBookingDto, userId: string, res: Response): Promise<Response<ResponseREST<IBooking>>>;

  findAll(
    query: QueryBookingDto,
    userId: string,
    req: any,
    res: Response,
  ): Promise<Response<ResponseREST<IBookingListResponse>>>;

  findAvailableVehicles(
    query: QueryAvailableVehiclesDto,
    userId: string,
    res: Response,
  ): Promise<Response<ResponseREST<IAvailableVehicle[]>>>;

  update(id: number, body: UpdateBookingDto, userId: string, res: Response): Promise<Response<ResponseREST<IBooking>>>;

  findOne(id: number, userId: string, res: Response): Promise<Response<ResponseREST<IBooking>>>;

  findTripDetail(id: number, userId: string, req: any, res: Response): Promise<Response<ResponseREST<ITripDetail>>>;
}
