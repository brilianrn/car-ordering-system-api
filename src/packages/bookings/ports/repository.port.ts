import { Booking, Prisma } from '@prisma/client';

export interface BookingsRepositoryPort {
  createWithTransaction(data: {
    booking: Prisma.BookingCreateInput;
    segment: Omit<Prisma.BookingSegmentCreateInput, 'booking'>;
    approvalHeader?: Omit<Prisma.ApprovalHeaderCreateInput, 'booking'>; // Optional for draft bookings
  }): Promise<any>;

  findMany(params: {
    skip: number;
    take: number;
    where?: Prisma.BookingWhereInput;
    include?: Prisma.BookingInclude;
  }): Promise<Booking[]>;

  count(where?: Prisma.BookingWhereInput): Promise<number>;

  findCategoryById(id: number): Promise<{ id: number; code: string; name: string } | null>;

  findEmployeeById(
    employeeId: string,
  ): Promise<{ employeeId: string; approverL1Id: string | null; fullName: string; email: string } | null>;

  findBookingByNumber(bookingNumber: string): Promise<Booking | null>;

  findEmployeeByEmployeeId(
    employeeId: string,
  ): Promise<{ employeeId: string; approverL1Id: string | null; fullName: string; email: string } | null>;

  findAvailableVehicles(params: {
    startAt?: Date;
    endAt?: Date;
    requesterId?: string; // To get user's orgUnitId for sorting
  }): Promise<
    Array<{
      id: number;
      vehicleCode: string;
      licensePlate: string;
      brandModel: string;
      vehicleType: string;
      seatCapacity: number;
      year: number;
      status: string;
      dedicatedOrgId: number | null;
    }>
  >;

  findById(id: number, include?: Prisma.BookingInclude): Promise<Booking | null>;

  update(id: number, data: Prisma.BookingUpdateInput): Promise<Booking>;

  updateSegment(bookingId: number, data: Prisma.BookingSegmentUpdateInput): Promise<void>;

  findApprovalHeaderByBookingId(bookingId: number): Promise<{ id: number; bookingId: number } | null>;

  createApprovalHeader(data: Prisma.ApprovalHeaderCreateInput): Promise<void>;
}
