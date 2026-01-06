import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { IBooking } from '@/packages/bookings/domain/response';
import { AssignBookingDto } from '../dto/assign-booking.dto';

export interface AssignmentUsecasePort {
  assignBooking(id: number, dto: AssignBookingDto, userId: string): Promise<IUsecaseResponse<IBooking>>;
}
