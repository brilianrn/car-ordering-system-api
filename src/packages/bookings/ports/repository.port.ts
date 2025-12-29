import { Booking, Prisma } from '@prisma/client';

export interface BookingsRepositoryPort {
  createWithTransaction(data: {
    booking: Prisma.BookingCreateInput;
    segment: Omit<Prisma.BookingSegmentCreateInput, 'booking'>;
    approvalHeader: Omit<Prisma.ApprovalHeaderCreateInput, 'booking'>;
  }): Promise<any>;

  findMany(params: {
    skip: number;
    take: number;
    where?: Prisma.BookingWhereInput;
    include?: Prisma.BookingInclude;
  }): Promise<Booking[]>;

  count(where?: Prisma.BookingWhereInput): Promise<number>;

  findCategoryById(id: number): Promise<{ id: number; code: string; name: string } | null>;

  findEmployeeById(employeeId: string): Promise<{ employeeId: string; approverL1Id: string | null } | null>;

  findBookingByNumber(bookingNumber: string): Promise<Booking | null>;

  findEmployeeByEmployeeId(employeeId: string): Promise<{ employeeId: string; approverL1Id: string | null } | null>;

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
}
