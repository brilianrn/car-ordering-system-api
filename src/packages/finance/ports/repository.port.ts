import { Driver, Prisma } from '@prisma/client';
import {
  IFinanceBooking,
  IFinanceReceiptItem,
  IFinanceSegmentExecution,
  IFinanceVerificationHeader,
} from '../domain/entities';

export interface FinanceRepositoryPort {
  findReceiptItemById(itemId: number): Promise<IFinanceReceiptItem | null>;
  updateReceiptItem(itemId: number, data: Prisma.ReceiptItemUpdateInput): Promise<void>;
  findVerificationHeaderByExecutionId(executionId: number): Promise<IFinanceVerificationHeader | null>;
  findVerificationHeaderById(verificationId: number): Promise<IFinanceVerificationHeader | null>;
  updateVerificationHeader(verificationId: number, data: Prisma.VerificationHeaderUpdateInput): Promise<void>;
  findSegmentExecutionById(executionId: number): Promise<IFinanceSegmentExecution | null>;
  findBookingById(bookingId: number): Promise<IFinanceBooking | null>;
  updateBooking(bookingId: number, data: Prisma.BookingUpdateInput): Promise<void>;
  updateManyBookings(where: Prisma.BookingWhereInput, data: Prisma.BookingUpdateInput): Promise<void>;
  updateSegment(segmentId: number, data: Prisma.BookingSegmentUpdateInput): Promise<void>;
  findReceiptItemsByHash(dupHash: string, excludeItemId?: number): Promise<IFinanceReceiptItem[]>;
  createAuditLog(data: Prisma.AuditLogCreateInput): Promise<void>;
  findDriverById(driverId: number): Promise<Driver | null>;
  updateDriver(driverId: number, data: Prisma.DriverUpdateInput): Promise<void>;
}
