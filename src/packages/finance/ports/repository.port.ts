import { Prisma } from '@prisma/client';

export interface FinanceRepositoryPort {
  findReceiptItemById(itemId: number): Promise<any | null>;
  updateReceiptItem(itemId: number, data: Prisma.ReceiptItemUpdateInput): Promise<void>;
  findVerificationHeaderByExecutionId(executionId: number): Promise<any | null>;
  findVerificationHeaderById(verificationId: number): Promise<any | null>;
  updateVerificationHeader(verificationId: number, data: Prisma.VerificationHeaderUpdateInput): Promise<void>;
  findSegmentExecutionById(executionId: number): Promise<any | null>;
  findBookingById(bookingId: number): Promise<any | null>;
  updateBooking(bookingId: number, data: Prisma.BookingUpdateInput): Promise<void>;
  updateSegment(segmentId: number, data: Prisma.BookingSegmentUpdateInput): Promise<void>;
  findReceiptItemsByHash(dupHash: string, excludeItemId?: number): Promise<any[]>;
  createAuditLog(data: Prisma.AuditLogCreateInput): Promise<void>;
  findDriverById(driverId: number): Promise<any | null>;
  updateDriver(driverId: number, data: Prisma.DriverUpdateInput): Promise<void>;
}
