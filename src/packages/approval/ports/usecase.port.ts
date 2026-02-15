import { IBooking, IBookingListResponse } from '@/packages/bookings/domain/response';
import { IUsecaseResponse } from '@/shared/utils/rest-api/types';
import { ApproveBookingDto } from '../dto/approve-booking.dto';
import { QueryApprovalListDto } from '../dto/query-approval-list.dto';

export interface ApprovalUsecasePort {
  approveBooking(id: number, dto: ApproveBookingDto, user: any): Promise<IUsecaseResponse<IBooking>>;
  findApprovalList(query: QueryApprovalListDto, user: any): Promise<IUsecaseResponse<IBookingListResponse>>;
}
