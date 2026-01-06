import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { IBooking, IBookingListResponse } from '@/packages/bookings/domain/response';
import { ApproveBookingDto } from '../dto/approve-booking.dto';
import { QueryApprovalListDto } from '../dto/query-approval-list.dto';

export interface ApprovalUsecasePort {
  approveBooking(id: number, dto: ApproveBookingDto, userId: string): Promise<IUsecaseResponse<IBooking>>;
  findApprovalList(query: QueryApprovalListDto, userId: string): Promise<IUsecaseResponse<IBookingListResponse>>;
}
