import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { IBooking, IBookingListResponse } from '../domain/response';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { QueryBookingDto } from '../dto/query-booking.dto';

export interface BookingsUsecasePort {
  create(createDto: CreateBookingDto, requesterId: string, userId: string): Promise<IUsecaseResponse<IBooking>>;

  findAll(query: QueryBookingDto, requesterId?: string): Promise<IUsecaseResponse<IBookingListResponse>>;
}
