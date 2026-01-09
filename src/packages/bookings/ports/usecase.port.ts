import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { IAvailableVehicle, IBooking, IBookingListResponse, ITripDetail } from '../domain/response';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { QueryAvailableVehiclesDto } from '../dto/query-available-vehicles.dto';
import { QueryBookingDto } from '../dto/query-booking.dto';
import { UpdateBookingDto } from '../dto/update-booking.dto';

export interface BookingsUsecasePort {
  create(createDto: CreateBookingDto, requesterId: string, userId: string): Promise<IUsecaseResponse<IBooking>>;

  findAll(query: QueryBookingDto, requesterId?: string): Promise<IUsecaseResponse<IBookingListResponse>>;

  findAvailableVehicles(
    query: QueryAvailableVehiclesDto,
    requesterId?: string,
  ): Promise<IUsecaseResponse<IAvailableVehicle[]>>;

  update(
    id: number,
    updateDto: UpdateBookingDto,
    requesterId: string,
    userId: string,
  ): Promise<IUsecaseResponse<IBooking>>;

  findOne(id: number, requesterId?: string): Promise<IUsecaseResponse<IBooking>>;

  findTripDetail(id: number, userId?: string): Promise<IUsecaseResponse<ITripDetail>>;
}
