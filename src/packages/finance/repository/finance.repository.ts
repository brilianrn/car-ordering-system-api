import { clientDb } from '@/shared/utils';
import { globalLogger as Logger } from '@/shared/utils/logger';
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { FinanceRepositoryPort } from '../ports/repository.port';

@Injectable()
export class FinanceRepository implements FinanceRepositoryPort {
  private readonly db: PrismaClient = clientDb;

  findReceiptItemById = async (itemId: number): Promise<any | null> => {
    try {
      return await this.db.receiptItem.findUnique({
        where: { id: itemId, deletedAt: null },
        include: {
          verification: {
            include: {
              segmentExecution: {
                include: {
                  segment: {
                    include: {
                      booking: {
                        include: {
                          requester: true,
                          assignment: {
                            include: {
                              driverChosen: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findReceiptItemById',
        error instanceof Error ? error.stack : undefined,
        'FinanceRepository.findReceiptItemById',
      );
      throw error;
    }
  };

  updateReceiptItem = async (itemId: number, data: Prisma.ReceiptItemUpdateInput): Promise<void> => {
    try {
      await this.db.receiptItem.update({
        where: { id: itemId },
        data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in updateReceiptItem',
        error instanceof Error ? error.stack : undefined,
        'FinanceRepository.updateReceiptItem',
      );
      throw error;
    }
  };

  findVerificationHeaderByExecutionId = async (executionId: number): Promise<any | null> => {
    try {
      return await this.db.verificationHeader.findUnique({
        where: { segmentExecutionId: executionId, deletedAt: null },
        include: {
          receiptItems: {
            where: { deletedAt: null },
          },
          segmentExecution: {
            include: {
              segment: {
                include: {
                  booking: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findVerificationHeaderByExecutionId',
        error instanceof Error ? error.stack : undefined,
        'FinanceRepository.findVerificationHeaderByExecutionId',
      );
      throw error;
    }
  };

  findVerificationHeaderById = async (verificationId: number): Promise<any | null> => {
    try {
      return await this.db.verificationHeader.findUnique({
        where: { id: verificationId, deletedAt: null },
        include: {
          receiptItems: {
            where: { deletedAt: null },
          },
          segmentExecution: {
            include: {
              segment: {
                include: {
                  booking: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findVerificationHeaderById',
        error instanceof Error ? error.stack : undefined,
        'FinanceRepository.findVerificationHeaderById',
      );
      throw error;
    }
  };

  updateVerificationHeader = async (
    verificationId: number,
    data: Prisma.VerificationHeaderUpdateInput,
  ): Promise<void> => {
    try {
      await this.db.verificationHeader.update({
        where: { id: verificationId },
        data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in updateVerificationHeader',
        error instanceof Error ? error.stack : undefined,
        'FinanceRepository.updateVerificationHeader',
      );
      throw error;
    }
  };

  findSegmentExecutionById = async (executionId: number): Promise<any | null> => {
    try {
      return await this.db.segmentExecution.findUnique({
        where: { id: executionId, deletedAt: null },
        include: {
          segment: {
            include: {
              booking: true,
            },
          },
          verification: {
            include: {
              receiptItems: {
                where: { deletedAt: null },
              },
            },
          },
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findSegmentExecutionById',
        error instanceof Error ? error.stack : undefined,
        'FinanceRepository.findSegmentExecutionById',
      );
      throw error;
    }
  };

  findBookingById = async (bookingId: number): Promise<any | null> => {
    try {
      return await this.db.booking.findUnique({
        where: { id: bookingId, deletedAt: null },
        include: {
          segments: {
            where: { deletedAt: null },
            include: {
              execution: {
                include: {
                  verification: {
                    include: {
                      receiptItems: {
                        where: { deletedAt: null },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findBookingById',
        error instanceof Error ? error.stack : undefined,
        'FinanceRepository.findBookingById',
      );
      throw error;
    }
  };

  updateBooking = async (bookingId: number, data: Prisma.BookingUpdateInput): Promise<void> => {
    try {
      await this.db.booking.update({
        where: { id: bookingId },
        data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in updateBooking',
        error instanceof Error ? error.stack : undefined,
        'FinanceRepository.updateBooking',
      );
      throw error;
    }
  };

  updateSegment = async (segmentId: number, data: Prisma.BookingSegmentUpdateInput): Promise<void> => {
    try {
      await this.db.bookingSegment.update({
        where: { id: segmentId },
        data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in updateSegment',
        error instanceof Error ? error.stack : undefined,
        'FinanceRepository.updateSegment',
      );
      throw error;
    }
  };

  findReceiptItemsByHash = async (dupHash: string, excludeItemId?: number): Promise<any[]> => {
    try {
      return await this.db.receiptItem.findMany({
        where: {
          dupHash,
          deletedAt: null,
          ...(excludeItemId ? { id: { not: excludeItemId } } : {}),
        },
        include: {
          verification: {
            include: {
              segmentExecution: {
                include: {
                  segment: {
                    include: {
                      booking: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findReceiptItemsByHash',
        error instanceof Error ? error.stack : undefined,
        'FinanceRepository.findReceiptItemsByHash',
      );
      throw error;
    }
  };

  createAuditLog = async (data: Prisma.AuditLogCreateInput): Promise<void> => {
    try {
      await this.db.auditLog.create({
        data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in createAuditLog',
        error instanceof Error ? error.stack : undefined,
        'FinanceRepository.createAuditLog',
      );
      throw error;
    }
  };

  findDriverById = async (driverId: number): Promise<any | null> => {
    try {
      return await this.db.driver.findUnique({
        where: { id: driverId, deletedAt: null },
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in findDriverById',
        error instanceof Error ? error.stack : undefined,
        'FinanceRepository.findDriverById',
      );
      throw error;
    }
  };

  updateDriver = async (driverId: number, data: Prisma.DriverUpdateInput): Promise<void> => {
    try {
      await this.db.driver.update({
        where: { id: driverId },
        data,
      });
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in updateDriver',
        error instanceof Error ? error.stack : undefined,
        'FinanceRepository.updateDriver',
      );
      throw error;
    }
  };
}
