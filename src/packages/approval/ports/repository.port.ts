import { ApprovalHeader, Prisma } from '@prisma/client';

export interface ApprovalRepositoryPort {
  findApprovalHeaderByBookingId(bookingId: number): Promise<ApprovalHeader | null>;

  updateApprovalHeader(bookingId: number, data: Prisma.ApprovalHeaderUpdateInput): Promise<void>;

  findBookingById(id: number, include?: Prisma.BookingInclude): Promise<any | null>;

  updateBooking(id: number, data: Prisma.BookingUpdateInput): Promise<any>;

  findApprovalList(params: {
    skip: number;
    take: number;
    where: Prisma.BookingWhereInput;
    orderBy?: Prisma.BookingOrderByWithRelationInput;
  }): Promise<any[]>;

  countApprovalList(where: Prisma.BookingWhereInput): Promise<number>;
}
