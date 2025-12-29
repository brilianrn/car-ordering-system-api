import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { IAvailableVehicle, IBooking, IBookingListResponse } from '../domain/response';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { QueryAvailableVehiclesDto } from '../dto/query-available-vehicles.dto';
import { QueryBookingDto } from '../dto/query-booking.dto';

export interface BookingsUsecasePort {
  create(createDto: CreateBookingDto, requesterId: string, userId: string): Promise<IUsecaseResponse<IBooking>>;

  findAll(query: QueryBookingDto, requesterId?: string): Promise<IUsecaseResponse<IBookingListResponse>>;

  findAvailableVehicles(query: QueryAvailableVehiclesDto, requesterId?: string): Promise<IUsecaseResponse<IAvailableVehicle[]>>;
}
