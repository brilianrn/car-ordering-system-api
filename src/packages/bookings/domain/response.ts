import { ApprovalHeader, Booking, BookingSegment, Category } from '@prisma/client';

export interface IBookingSegment extends BookingSegment {}

export interface IBookingCategory extends Category {}

export interface IApprovalHeader extends ApprovalHeader {
  approverL1?: {
    employeeId: string;
    fullName: string;
    email: string;
  } | null;
}

export interface IBooking extends Booking {
  category?: IBookingCategory | null;
  segments?: IBookingSegment[];
  approvalHeader?: IApprovalHeader | null;
  requester?: {
    employeeId: string;
    fullName: string;
    email: string;
  } | null;
}

export interface IBookingListResponse {
  data: IBooking[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}
