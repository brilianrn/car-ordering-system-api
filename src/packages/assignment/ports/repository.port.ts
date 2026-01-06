import { Prisma } from '@prisma/client';

export interface AssignmentRepositoryPort {
  findBookingById(id: number, include?: Prisma.BookingInclude): Promise<any | null>;

  findVehicleById(vehicleId: number): Promise<any | null>;

  findDriverById(driverId: number): Promise<any | null>;

  findAssignmentByBookingId(bookingId: number): Promise<any | null>;

  createAssignment(data: Prisma.AssignmentCreateInput): Promise<any>;

  updateBooking(id: number, data: Prisma.BookingUpdateInput): Promise<any>;

  updateApprovalHeader(bookingId: number, data: Prisma.ApprovalHeaderUpdateInput): Promise<void>;
}
